from datetime import UTC, datetime, timedelta

import jwt
from passlib.context import CryptContext

from app.core.config import settings

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def create_token(subject: str, role: str, token_type: str, expires_delta: timedelta) -> str:
    expire = datetime.now(UTC) + expires_delta
    payload = {"sub": subject, "role": role, "type": token_type, "exp": expire}
    return jwt.encode(payload, settings.secret_key, algorithm="HS256")


def create_access_token(subject: str, role: str) -> str:
    return create_token(subject, role, "access", timedelta(minutes=settings.access_token_expire_minutes))


def create_refresh_token(subject: str, role: str) -> str:
    return create_token(subject, role, "refresh", timedelta(days=settings.refresh_token_expire_days))


def decode_token(token: str) -> dict:
    return jwt.decode(token, settings.secret_key, algorithms=["HS256"])
