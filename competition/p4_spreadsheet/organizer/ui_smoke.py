"""Headless smoke test of the pygame UI against the reference engine."""
import os
import sys

os.environ.setdefault("SDL_VIDEODRIVER", "dummy")
sys.path.insert(0, os.path.join(os.path.dirname(__file__), "..", "handout"))
sys.path.insert(1, os.path.dirname(__file__))

import pygame

import ui
from solution_engine import Spreadsheet

app = ui.App(Spreadsheet())


def key(k, ch=""):
    app.handle(pygame.event.Event(pygame.KEYDOWN, key=k, unicode=ch))


def type_text(t):
    for ch in t:
        key(ord(ch), ch)
    key(pygame.K_RETURN)


app.sel = (0, 0)
for text in ("4", "3", "=A1*A0"):
    type_text(text)
app.draw()
assert app.sheet.get_value("A2") == 12, app.sheet.get_value("A2")
app.handle(pygame.event.Event(pygame.MOUSEBUTTONDOWN, button=1, pos=(ui.HEADER_W + 5, ui.BAR_H + ui.HEADER_H + 5)))
assert app.sel == (0, 0)
type_text("5")
assert app.sheet.get_value("A2") == 15
app.sel = (1, 0)
type_text("=B1"); app.sel = (1, 1); type_text("=B0")
assert app.sheet.get_value("B0") == "#CYCLE"
app.draw()
pygame.image.save(app.screen, os.path.join(os.environ.get("TMPDIR", "/tmp"), "sheet_smoke.png"))
print("ui smoke ok")
