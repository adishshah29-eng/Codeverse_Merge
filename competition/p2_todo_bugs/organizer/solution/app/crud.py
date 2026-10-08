from typing import List, Optional

from sqlalchemy import select
from sqlalchemy.orm import Session

from . import models, schemas


def create_todo(db: Session, data: schemas.TodoCreate) -> models.Todo:
    todo = models.Todo(title=data.title, description=data.description)
    db.add(todo)
    db.commit()
    db.refresh(todo)
    return todo


def get_todo(db: Session, todo_id: int) -> Optional[models.Todo]:
    return db.get(models.Todo, todo_id)


def list_todos(db: Session, skip: int = 0, limit: int = 10) -> List[models.Todo]:
    # `skip` is the number of rows to skip, `limit` the page size.
    stmt = select(models.Todo).order_by(models.Todo.id).offset(skip).limit(limit)
    return list(db.scalars(stmt))


def update_todo(db: Session, todo: models.Todo, data: schemas.TodoUpdate) -> models.Todo:
    for field, value in data.model_dump(exclude_unset=True).items():
        setattr(todo, field, value)
    db.commit()
    db.refresh(todo)
    return todo


def complete_todo(db: Session, todo: models.Todo) -> models.Todo:
    todo.completed = True
    db.commit()
    db.refresh(todo)
    return todo


def delete_todo(db: Session, todo: models.Todo) -> None:
    db.delete(todo)
    db.commit()
