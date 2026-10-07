import os
import secrets
import re
from fastapi import APIRouter, Depends, HTTPException, status, Header
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, text
from sqlalchemy.exc import IntegrityError

from app.db.database import get_db
from app.db.models import User, Department, RoleEnum, AccountStatusEnum, LabAssistantAssignment
from app.schemas.user import UserRegistration, UserUpdate, User as UserSchema
from app.schemas.token import Token
from app.core import security
from app.api.deps import get_current_user, require_admin
from app.services.user_ids import institutional_id, next_assistant_number
from app.services.registration_departments import REGISTRATION_DEPARTMENTS

router = APIRouter()

@router.get('/registration-departments')
async def registration_departments(db: AsyncSession = Depends(get_db)):
    departments = (await db.execute(select(Department).where(
        Department.code.in_(REGISTRATION_DEPARTMENTS)))).scalars().all()
    by_code = {department.code: department for department in departments}
    return [{'id': by_code[code].id, 'code': code, 'name': by_code[code].name}
            for code in REGISTRATION_DEPARTMENTS if code in by_code]


@router.post("/register", response_model=UserSchema)
async def register(
    user_in: UserRegistration,
    db: AsyncSession = Depends(get_db)
):
    if user_in.role == RoleEnum.ADMIN:
        raise HTTPException(status_code=403, detail="Cannot register admin users")

    department = await db.get(Department, user_in.department_id)
    if department is None or department.code not in REGISTRATION_DEPARTMENTS:
        raise HTTPException(status_code=400, detail='Select a valid registration department.')

    # FIX: Always normalize email to lowercase before inserting
    normalized_email = user_in.email.lower()
    university_id = user_in.university_id

    result = await db.execute(select(User).where(User.email == normalized_email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="A user with this email already exists.",
        )
    if university_id and (await db.execute(select(User.id).where(User.university_id == university_id))).first():
        raise HTTPException(status_code=400, detail="A user with this institutional ID already exists.")

    status_val = AccountStatusEnum.ACTIVE if user_in.role == RoleEnum.STUDENT else AccountStatusEnum.PENDING
    db_user = User(
        email=normalized_email,
        university_id=university_id,
        hashed_password=security.get_password_hash(user_in.password),
        name=user_in.name,
        role=user_in.role,
        department_id=user_in.department_id,
        account_status=status_val
    )
    db.add(db_user)
    try:
        if db_user.role == RoleEnum.ASSISTANT:
            db_user.assistant_number = await next_assistant_number(db)
        await db.commit()
    except ValueError as error:
        await db.rollback()
        raise HTTPException(status_code=409, detail=str(error))
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail="Email or institutional ID is already registered.")
    await db.refresh(db_user)
    return db_user

# --- SEC-1: Bootstrap seed endpoint — PROTECTED by a one-time setup token ---
@router.post("/seed", response_model=UserSchema)
async def seed_admin(
    x_bootstrap_token: str = Header(..., alias="X-Bootstrap-Token"),
    db: AsyncSession = Depends(get_db)
):
    """Create the initial admin user.

    Requires X-Bootstrap-Token header matching the BOOTSTRAP_SECRET env variable.
    Only works if no admin exists yet.
    """
    bootstrap_secret = os.environ.get("BOOTSTRAP_SECRET", "")
    if not bootstrap_secret or not secrets.compare_digest(x_bootstrap_token, bootstrap_secret):
        raise HTTPException(
            status_code=403,
            detail="Invalid or missing bootstrap token."
        )

    await db.execute(text('SELECT pg_advisory_xact_lock(48290123)'))
    result = await db.execute(select(User).where(User.role == RoleEnum.ADMIN))
    existing_admin = result.scalars().first()
    if existing_admin:
        raise HTTPException(
            status_code=400,
            detail="An admin user already exists. Seed endpoint is disabled."
        )

    admin_email = os.environ.get("ADMIN_EMAIL", "admin@university.edu")
    admin_password = os.environ.get("ADMIN_PASSWORD", "")
    if not admin_password:
        raise HTTPException(status_code=500, detail="ADMIN_PASSWORD env variable not set")

    admin_user = User(
        email=admin_email.lower(),
        hashed_password=security.get_password_hash(admin_password),
        name="System Administrator",
        role=RoleEnum.ADMIN,
        department_id=None
    )
    db.add(admin_user)
    await db.commit()
    await db.refresh(admin_user)
    return admin_user

@router.post("/login", response_model=Token)
async def login(
    db: AsyncSession = Depends(get_db),
    form_data: OAuth2PasswordRequestForm = Depends()
):
    # FIX: Support login by email (lowercase) OR university_id
    username = form_data.username.strip()
    assistant_match = re.fullmatch(r'ASST([0-9]{3})', username.upper())
    conditions = [User.email == username.lower(), User.university_id == username.upper()]
    if assistant_match:
        conditions = [(User.role == RoleEnum.ASSISTANT) & (User.assistant_number == int(assistant_match[1]))]
    result = await db.execute(
        select(User).where(
            or_(*conditions)
        )
    )
    user = result.scalars().first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email/university ID or password",
        )

    if user.account_status != AccountStatusEnum.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.account_status.value.lower()}"
        )

    access_token = security.create_access_token(subject=user.id, role=user.role.value)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserSchema)
async def read_users_me(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # FIX: Populate assigned_lab_ids for assistant users so the frontend
    # AuthContext has correct lab assignments without a separate API call.
    assigned_lab_ids = []
    if current_user.role == RoleEnum.ASSISTANT:
        result = await db.execute(
            select(LabAssistantAssignment.lab_id)
            .where(LabAssistantAssignment.assistant_id == current_user.id)
        )
        assigned_lab_ids = list(result.scalars().all())

    # Attach the computed field to the response
    # We do this by constructing the schema manually so we can inject the extra field
    from app.schemas.user import User as UserSchema_
    user_data = UserSchema_.model_validate(current_user)
    user_data.assigned_lab_ids = assigned_lab_ids
    return user_data

# --- SEC-4: User list restricted to admin only ---
@router.get("/users", response_model=list[UserSchema])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(User))
    return result.scalars().all()

@router.get("/users/lookup", response_model=list[UserSchema])
async def lookup_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lookup users by name, email, university_id, or exact numeric ID.

    Admins can search all fields without restriction.
    Assistants can search by exact university_id only (for counter operations).
    """
    q = q.strip()
    assistant_match = re.fullmatch(r'ASST([0-9]{3})', q.upper())
    if current_user.role == RoleEnum.ADMIN:
        # Admin: full search
        conditions = [
            User.name.ilike(f"%{q}%"),
            User.email.ilike(f"%{q}%"),
        ]
        if q.isdigit():
            conditions.append(User.id == int(q))
        if q:
            conditions.append(User.university_id == q.upper())
        if assistant_match:
            conditions.append((User.role == RoleEnum.ASSISTANT) & (User.assistant_number == int(assistant_match[1])))
        result = await db.execute(
            select(User).where(or_(*conditions)).limit(10)
        )
    elif current_user.role == RoleEnum.ASSISTANT:
        # Assistant: scoped lookup — exact university_id match only
        # This is used for counter operations (issue/quick-borrow)
        q = q.strip()
        if not q:
            raise HTTPException(status_code=400, detail="Search query required")
        result = await db.execute(
            select(User).where(
                or_(
                    User.university_id == q.upper(),
                    (User.role == RoleEnum.ASSISTANT) & (User.assistant_number == int(assistant_match[1])) if assistant_match else False,
                    User.email == q.lower(),
                    # Support cards for existing students whose institutional
                    # ID was not populated by older registration versions.
                    (User.role == RoleEnum.STUDENT) & (User.email == f"{q.lower()}@charusat.edu.in"),
                )
            ).limit(5)
        )
    else:
        raise HTTPException(status_code=403, detail="Not authorized to look up users")

    return result.scalars().all()

# --- BE-3d: User CRUD ---
@router.put("/users/{user_id}", response_model=UserSchema)
async def update_user(
    user_id: int,
    user_update: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    update_data = user_update.model_dump(exclude_unset=True)
    if 'role' in update_data or 'university_id' in update_data:
        role = update_data.get('role', user.role)
        try:
            update_data['university_id'] = institutional_id(role, update_data.get('university_id', user.university_id)
                or update_data.get('email', user.email).split('@')[0]) if role != RoleEnum.ASSISTANT else None
            if role == RoleEnum.ASSISTANT and not user.assistant_number:
                user.assistant_number = await next_assistant_number(db)
        except ValueError as error:
            raise HTTPException(status_code=400, detail=str(error))

    if "account_status" in update_data:
        new_status = update_data["account_status"]
        if new_status == AccountStatusEnum.ACTIVE and user.account_status == AccountStatusEnum.PENDING:
            from sqlalchemy.sql import func
            user.approved_by_id = current_user.id
            user.approved_at = func.now()

    for field, value in update_data.items():
        setattr(user, field, value)

    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=400, detail='Email or institutional ID is already registered')
    await db.refresh(user)
    return user

@router.delete("/users/{user_id}")
async def delete_user(
    user_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    try:
        await db.delete(user)
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(
            status_code=409,
            detail="Cannot delete user: they have associated borrowing history, lab assignments, or other records. Deactivate the account instead."
        )
    return {"message": "User deleted successfully"}
