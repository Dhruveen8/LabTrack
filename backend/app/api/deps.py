from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
import jwt
from pydantic import ValidationError

from app.core.config import settings
from app.db.database import get_db
from app.db.models import User, RoleEnum, AccountStatusEnum
from app.core.security import TokenPayload

reusable_oauth2 = OAuth2PasswordBearer(
    tokenUrl=f"{settings.API_V1_STR}/auth/login"
)

async def get_current_user(
    db: AsyncSession = Depends(get_db), token: str = Depends(reusable_oauth2)
) -> User:
    try:
        payload = jwt.decode(
            token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM]
        )
        token_data = TokenPayload(**payload)
        user_id = int(token_data.sub)
    except (jwt.PyJWTError, ValidationError, TypeError, ValueError):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={'WWW-Authenticate': 'Bearer'},
        )

    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()

    if not user:
        raise HTTPException(status_code=401, detail="User not found", headers={'WWW-Authenticate': 'Bearer'})

    if user.account_status != AccountStatusEnum.ACTIVE:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail=f"Account is {user.account_status.value.lower()}"
        )

    return user

def require_role(roles: list[RoleEnum] | RoleEnum):
    if not isinstance(roles, list):
        roles = [roles]

    async def role_dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"User doesn't have sufficient privileges. Required: {[r.value for r in roles]}",
            )
        return current_user
    return role_dependency

def require_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != RoleEnum.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="The user doesn't have enough privileges"
        )
    return current_user
