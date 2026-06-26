from pydantic import BaseModel, EmailStr


class UserCreate(BaseModel):
    email: EmailStr
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class LessonProgressSchema(BaseModel):
    lessonId: int
    bestWpm: int
    lastWpm: int
    lastAccuracy: float
    lastTime: int
    completedAt: str
    timesCompleted: int


class BulkProgressSchema(BaseModel):
    lessons: list[LessonProgressSchema]
