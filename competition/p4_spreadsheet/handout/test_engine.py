"""Public tests (a subset of the grader). Run: pytest -q test_engine.py"""
from engine import Spreadsheet


def sheet(**cells):
    s = Spreadsheet()
    for ref, raw in cells.items():
        s.set_cell(ref, raw)
    return s


def test_plain_number():
    assert sheet(A0="4").get_value("A0") == 4


def test_single_operator_formula():
    s = sheet(A0="4", A1="3", A2="=A1 * A0")
    assert s.get_value("A2") == 12


def test_chained_reference():
    s = sheet(B1="2", B3="5", A3="=B3 * B1")
    assert s.get_value("A3") == 10
    s.set_cell("C0", "=A3+1")
    assert s.get_value("C0") == 11


def test_precedence():
    assert sheet(A0="=1+2*3").get_value("A0") == 7
    assert sheet(A0="=(1+2)*3").get_value("A0") == 9


def test_propagation():
    s = sheet(A0="4", A1="3", A2="=A1 * A0")
    s.set_cell("A0", "5")
    assert s.get_value("A2") == 15


def test_cycle_is_an_error_not_a_hang():
    s = sheet(A0="=A1", A1="=A0")
    assert s.get_value("A0") == "#CYCLE"
    assert s.get_value("A1") == "#CYCLE"
