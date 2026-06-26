from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from datetime import datetime
from database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    progress = relationship("Progress", back_populates="user", cascade="all, delete-orphan")


class Progress(Base):
    __tablename__ = "progress"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    lesson_id = Column(Integer, nullable=False)
    best_wpm = Column(Integer, default=0)
    last_wpm = Column(Integer, default=0)
    last_accuracy = Column(Float, default=0)
    last_time = Column(Integer, default=0)
    completed_at = Column(String, nullable=True)
    times_completed = Column(Integer, default=1)

    user = relationship("User", back_populates="progress")

    __table_args__ = (UniqueConstraint("user_id", "lesson_id", name="uq_user_lesson"),)
