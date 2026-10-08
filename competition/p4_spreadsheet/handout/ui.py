"""Pygame grid UI (handout -- you do not need to edit this).

Scrollable grid; click a cell to select it, type to edit, Enter to commit,
Esc to cancel, arrow keys / Tab to move, mouse wheel (Shift = horizontal) to scroll.
The selected cell shows its raw text in the formula bar; other cells show
`sheet.get_value(ref)`.

    pip install pygame
    python ui.py
"""
import os
import sys

import pygame

from engine import Spreadsheet

COLS, ROWS = 26, 100
CELL_W, CELL_H = 96, 26
HEADER_W, HEADER_H = 48, 26
BAR_H = 34

BG = (250, 250, 250)
GRID = (210, 210, 214)
HEADER_BG = (236, 238, 242)
SELECT = (33, 115, 70)
TEXT = (30, 30, 34)
ERROR = (190, 40, 40)
NUMBER_ALIGN_RIGHT = True


def col_name(c):
    s = ""
    c += 1
    while c:
        c, r = divmod(c - 1, 26)
        s = chr(65 + r) + s
    return s


def ref_name(c, r):
    return f"{col_name(c)}{r}"


class App:
    def __init__(self, sheet=None, size=(960, 600)):
        pygame.init()
        pygame.display.set_caption("CODEVERSE Spreadsheet")
        self.screen = pygame.display.set_mode(size, pygame.RESIZABLE)
        self.font = pygame.font.SysFont("dejavusansmono,menlo,consolas,monospace", 15)
        self.bold = pygame.font.SysFont("dejavusansmono,menlo,consolas,monospace", 15, bold=True)
        self.sheet = sheet or Spreadsheet()
        self.sel = (0, 0)          # (col, row)
        self.scroll = [0, 0]       # first visible (col, row)
        self.editing = False
        self.buffer = ""
        self.clock = pygame.time.Clock()

    # ---- helpers ------------------------------------------------------------
    def visible(self):
        w, h = self.screen.get_size()
        return (w - HEADER_W) // CELL_W + 1, (h - BAR_H - HEADER_H) // CELL_H + 1

    def cell_at(self, pos):
        x, y = pos
        if x < HEADER_W or y < BAR_H + HEADER_H:
            return None
        c = (x - HEADER_W) // CELL_W + self.scroll[0]
        r = (y - BAR_H - HEADER_H) // CELL_H + self.scroll[1]
        return (c, r) if 0 <= c < COLS and 0 <= r < ROWS else None

    def ensure_visible(self):
        vc, vr = self.visible()
        c, r = self.sel
        if c < self.scroll[0]:
            self.scroll[0] = c
        if c >= self.scroll[0] + vc - 1:
            self.scroll[0] = max(0, c - vc + 2)
        if r < self.scroll[1]:
            self.scroll[1] = r
        if r >= self.scroll[1] + vr - 1:
            self.scroll[1] = max(0, r - vr + 2)

    def commit(self):
        self.sheet.set_cell(ref_name(*self.sel), self.buffer)
        self.editing = False
        self.buffer = ""

    def move(self, dc, dr):
        c, r = self.sel
        self.sel = (min(max(c + dc, 0), COLS - 1), min(max(r + dr, 0), ROWS - 1))
        self.ensure_visible()

    # ---- events -------------------------------------------------------------
    def handle(self, event):
        if event.type == pygame.QUIT:
            return False
        if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
            cell = self.cell_at(event.pos)
            if cell:
                if self.editing:
                    self.commit()
                self.sel = cell
        elif event.type == pygame.MOUSEWHEEL:
            horizontal = pygame.key.get_mods() & pygame.KMOD_SHIFT
            if horizontal:
                self.scroll[0] = min(max(self.scroll[0] - event.y, 0), COLS - 1)
            else:
                self.scroll[1] = min(max(self.scroll[1] - event.y, 0), ROWS - 1)
        elif event.type == pygame.KEYDOWN:
            if event.key == pygame.K_RETURN:
                if self.editing:
                    self.commit()
                self.move(0, 1)
            elif event.key == pygame.K_ESCAPE:
                self.editing, self.buffer = False, ""
            elif event.key == pygame.K_TAB:
                if self.editing:
                    self.commit()
                self.move(1, 0)
            elif event.key == pygame.K_BACKSPACE:
                if not self.editing:
                    self.editing = True
                    self.buffer = self.sheet.get_raw(ref_name(*self.sel))
                self.buffer = self.buffer[:-1]
            elif event.key == pygame.K_DELETE and not self.editing:
                self.sheet.set_cell(ref_name(*self.sel), "")
            elif event.key in (pygame.K_UP, pygame.K_DOWN, pygame.K_LEFT, pygame.K_RIGHT) and not self.editing:
                dc = (event.key == pygame.K_RIGHT) - (event.key == pygame.K_LEFT)
                dr = (event.key == pygame.K_DOWN) - (event.key == pygame.K_UP)
                self.move(dc, dr)
            elif event.unicode and event.unicode.isprintable():
                if not self.editing:
                    self.editing, self.buffer = True, ""
                self.buffer += event.unicode
        return True

    # ---- drawing ------------------------------------------------------------
    def draw_text(self, text, rect, color=TEXT, font=None, right=False):
        surf = (font or self.font).render(str(text), True, color)
        clip = self.screen.get_clip()
        self.screen.set_clip(rect.clip(clip))
        x = rect.right - surf.get_width() - 5 if right else rect.x + 5
        self.screen.blit(surf, (x, rect.y + (rect.h - surf.get_height()) // 2))
        self.screen.set_clip(clip)

    def draw(self):
        self.screen.fill(BG)
        w, h = self.screen.get_size()
        vc, vr = self.visible()
        # formula bar
        bar = pygame.Rect(0, 0, w, BAR_H)
        pygame.draw.rect(self.screen, HEADER_BG, bar)
        ref = ref_name(*self.sel)
        shown = self.buffer if self.editing else self.sheet.get_raw(ref)
        self.draw_text(ref, pygame.Rect(4, 0, HEADER_W + 20, BAR_H), font=self.bold)
        self.draw_text(shown + ("|" if self.editing else ""), pygame.Rect(HEADER_W + 30, 0, w, BAR_H))
        # column / row headers
        for i in range(vc):
            c = self.scroll[0] + i
            if c >= COLS:
                break
            rect = pygame.Rect(HEADER_W + i * CELL_W, BAR_H, CELL_W, HEADER_H)
            pygame.draw.rect(self.screen, HEADER_BG, rect)
            pygame.draw.rect(self.screen, GRID, rect, 1)
            self.draw_text(col_name(c), rect, font=self.bold)
        for j in range(vr):
            r = self.scroll[1] + j
            if r >= ROWS:
                break
            rect = pygame.Rect(0, BAR_H + HEADER_H + j * CELL_H, HEADER_W, CELL_H)
            pygame.draw.rect(self.screen, HEADER_BG, rect)
            pygame.draw.rect(self.screen, GRID, rect, 1)
            self.draw_text(r, rect, font=self.bold)
        # cells
        for j in range(vr):
            for i in range(vc):
                c, r = self.scroll[0] + i, self.scroll[1] + j
                if c >= COLS or r >= ROWS:
                    continue
                rect = pygame.Rect(HEADER_W + i * CELL_W, BAR_H + HEADER_H + j * CELL_H, CELL_W, CELL_H)
                pygame.draw.rect(self.screen, GRID, rect, 1)
                name = ref_name(c, r)
                if (c, r) == self.sel and self.editing:
                    value, color = self.buffer, TEXT
                else:
                    value = self.sheet.get_value(name)
                    color = ERROR if isinstance(value, str) and value.startswith("#") else TEXT
                if value != "":
                    self.draw_text(value, rect, color, right=NUMBER_ALIGN_RIGHT and isinstance(value, (int, float)))
        # selection
        sc, sr = self.sel
        if self.scroll[0] <= sc < self.scroll[0] + vc and self.scroll[1] <= sr < self.scroll[1] + vr:
            rect = pygame.Rect(HEADER_W + (sc - self.scroll[0]) * CELL_W,
                               BAR_H + HEADER_H + (sr - self.scroll[1]) * CELL_H, CELL_W, CELL_H)
            pygame.draw.rect(self.screen, SELECT, rect, 3)

    def run(self):
        running = True
        while running:
            for event in pygame.event.get():
                running = self.handle(event) and running
            self.draw()
            pygame.display.flip()
            self.clock.tick(60)
        pygame.quit()


if __name__ == "__main__":
    App().run()
