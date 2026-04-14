from pydantic import BaseModel, EmailStr

from app.schemas.common import ORMModel


class LoginPayload(BaseModel):
    email: EmailStr
    password: str


class RefreshPayload(BaseModel):
    refresh_token: str


class TokenPair(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class UserMe(ORMModel):
    id: int
    email: EmailStr
    full_name: str
    role: str
