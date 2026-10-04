from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_

from app.db.database import get_db
from app.db.models import User, RoleEnum
from app.schemas.user import UserCreate, UserUpdate, User as UserSchema
from app.schemas.token import Token
from app.core import security
from app.api.deps import get_current_user, require_admin

router = APIRouter()

# --- SEC-1: Registration now requires admin authentication ---
@router.post("/register", response_model=UserSchema)
async def register(
    user_in: UserCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_admin)
):
    result = await db.execute(select(User).where(User.email == user_in.email))
    user = result.scalars().first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system.",
        )
    
    db_user = User(
        email=user_in.email,
        hashed_password=security.get_password_hash(user_in.password),
        name=user_in.name,
        role=user_in.role,
        department_id=user_in.department_id,
        assigned_labs=user_in.assigned_labs
    )
    db.add(db_user)
    await db.commit()
    await db.refresh(db_user)
    return db_user

# --- SEC-1: Bootstrap seed endpoint (unguarded, runs only once) ---
@router.post("/seed", response_model=UserSchema)
async def seed_admin(db: AsyncSession = Depends(get_db)):
    """Create the initial admin user. Only works if no admin exists yet."""
    result = await db.execute(select(User).where(User.role == RoleEnum.ADMIN))
    existing_admin = result.scalars().first()
    if existing_admin:
        raise HTTPException(
            status_code=400,
            detail="An admin user already exists. Seed endpoint is disabled."
        )

    admin_user = User(
        email="admin@university.edu",
        hashed_password=security.get_password_hash("admin123"),
        name="System Administrator",
        role=RoleEnum.ADMIN,
        department_id=None,
        assigned_labs=None
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
    result = await db.execute(select(User).where(User.email == form_data.username))
    user = result.scalars().first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password",
        )
    
    access_token = security.create_access_token(subject=user.id, role=user.role.value)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserSchema)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

# --- SEC-4: User list restricted to admin only ---
@router.get("/users", response_model=list[UserSchema])
async def list_users(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(User))
    return result.scalars().all()

@router.get("/users/lookup", response_model=list[UserSchema])
async def lookup_users(
    q: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    """Lookup users by name, email, or exact ID."""
    conditions = [
        User.name.ilike(f"%{q}%"),
        User.email.ilike(f"%{q}%")
    ]
    if q.isdigit():
        conditions.append(User.id == int(q))
        
    result = await db.execute(
        select(User).where(or_(*conditions)).limit(10)
    )
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
    for field, value in update_data.items():
        setattr(user, field, value)
    
    await db.commit()
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
    
    await db.delete(user)
    await db.commit()
    return {"message": "User deleted successfully"}
