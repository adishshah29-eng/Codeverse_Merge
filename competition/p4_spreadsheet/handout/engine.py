"""Spreadsheet formula engine -- THIS IS THE FILE YOU WRITE.

The pygame grid (ui.py) and the headless tests (test_engine.py) both talk to the
`Spreadsheet` class below. Right now it only stores text, so a cell holding
`=A1*A0` just displays the literal text `=A1*A0`.

Required behaviour
------------------
* A cell whose raw text starts with "=" is a formula. It supports + - * /,
  parentheses, numbers (ints and decimals) and cell references like A0, B3
  (column letters + 0-based row number; refs are case-insensitive).
* A reference resolves to that cell's *computed* value, so formulas chain:
  A3 "=B3*B1" where B3 and B1 are themselves formulas.
* Operator precedence and left-to-right associativity: "=1+2*3" -> 7, "=10-4-3" -> 3.
* Changing a cell recomputes everything *downstream* of it, in dependency
  (topological) order -- NOT a blind recompute of the whole grid.
* A reference cycle (A0 "=A1", A1 "=A0") must be reported as the error string
  "#CYCLE" in the offending cells -- never an infinite loop or a crash.
* Other errors are strings too: "#DIV/0!" (division by zero), "#ERR" (unparseable
  formula), "#VALUE!" (formula reads a text cell). Errors propagate to dependents.
* A plain cell is parsed as a number when it looks like one ("4" -> 4, "2.5" -> 2.5),
  otherwise it is text. An empty/unknown cell reads as 0 inside a formula.
* Whole-number results are returned as int (12, not 12.0).

Public API (do not rename -- the grader calls exactly these)
------------------------------------------------------------
    sheet = Spreadsheet()
    sheet.set_cell("A0", "4")          # raw text exactly as typed
    sheet.get_raw("A2")                # -> "=A1 * A0"
    sheet.get_value("A2")              # -> 12   (int/float/str)
    sheet.eval_count                   # total number of formula evaluations so far
                                       # (increment once each time a formula cell is
                                       #  evaluated; used to check you only recompute
                                       #  what is downstream of a change)
"""


class Spreadsheet:
    def __init__(self):
        self._raw = {}
        self.eval_count = 0

    @staticmethod
    def _norm(ref):
        return ref.strip().upper()

    def set_cell(self, ref, raw):
        raw = "" if raw is None else str(raw)
        ref = self._norm(ref)
        if raw == "":
            self._raw.pop(ref, None)
        else:
            self._raw[ref] = raw

    def get_raw(self, ref):
        return self._raw.get(self._norm(ref), "")

    def get_value(self, ref):
        # TODO: compute formulas (parse, resolve references, evaluate, detect cycles).
        return self.get_raw(ref)
