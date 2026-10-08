from typing import List

from fastapi import Depends, FastAPI, HTTPException, Query
from sqlalchemy.orm import Session

from . import crud, models, schemas
from .database import Base, engine, get_db

Base.metadata.create_all(bind=engine)

app = FastAPI(title="TODO API")


def _get_or_404(db: Session, todo_id: int) -> models.Todo:
    todo = crud.get_todo(db, todo_id)
    if todo is None:
        raise HTTPException(status_code=404, detail="Todo not found")
    return todo


@app.post("/todos", response_model=schemas.TodoOut)
def create_todo(data: schemas.TodoCreate, db: Session = Depends(get_db)):
    return crud.create_todo(db, data)


@app.get("/todos", response_model=List[schemas.TodoOut])
def list_todos(
    skip: int = Query(0, ge=0),
    limit: int = Query(10, ge=1, le=100),
    db: Session = Depends(get_db),
):
    return crud.list_todos(db, skip=skip, limit=limit)


@app.get("/todos/{todo_id}", response_model=schemas.TodoOut)
def read_todo(todo_id: int, db: Session = Depends(get_db)):
    return _get_or_404(db, todo_id)


@app.patch("/todos/{todo_id}", response_model=schemas.TodoOut)
def update_todo(todo_id: int, data: schemas.TodoUpdate, db: Session = Depends(get_db)):
    return crud.update_todo(db, _get_or_404(db, todo_id), data)


@app.post("/todos/{todo_id}/complete", response_model=schemas.TodoOut)
def complete_todo(todo_id: int, db: Session = Depends(get_db)):
    return crud.complete_todo(db, _get_or_404(db, todo_id))


@app.delete("/todos/{todo_id}", status_code=204)
def delete_todo(todo_id: int, db: Session = Depends(get_db)):
    crud.delete_todo(db, _get_or_404(db, todo_id))
