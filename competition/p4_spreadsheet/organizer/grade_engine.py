"""Headless grader for the spreadsheet engine (organizer / platform).

    python grade_engine.py <dir containing engine.py>      -> prints one JSON object

Weighted by tier: baseline (eval + precedence), core (chains + propagation),
hard (topological/minimal recompute + cycles).  Each case is a function returning
True/False; exceptions and hangs (per-case alarm) count as failures.
"""
import importlib.util
import json
import signal
import sys


def load(path):
    spec = importlib.util.spec_from_file_location("engine_under_test", path)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod.Spreadsheet


def make(S, **cells):
    s = S()
    for k, v in cells.items():
        s.set_cell(k, v)
    return s


def same(v, want):
    if isinstance(want, str):
        return v == want
    return isinstance(v, (int, float)) and not isinstance(v, bool) and abs(v - want) < 1e-9


def build_cases(S):
    C = []   # (name, tier, weight, fn)

    def case(name, tier, weight):
        def deco(fn):
            C.append((name, tier, weight, fn))
            return fn
        return deco

    # ---- baseline: basic eval and precedence -------------------------------
    @case("plain number", "baseline", 1)
    def _():
        return same(make(S, A0="4").get_value("A0"), 4)

    @case("single operator formula (A2 = A1*A0 = 12)", "baseline", 2)
    def _():
        return same(make(S, A0="4", A1="3", A2="=A1 * A0").get_value("A2"), 12)

    @case("all four operators", "baseline", 1)
    def _():
        s = make(S, A0="=6+2", A1="=6-2", A2="=6*2", A3="=6/2")
        return [s.get_value(r) for r in ("A0", "A1", "A2", "A3")] == [8, 4, 12, 3]

    @case("precedence =1+2*3 -> 7", "baseline", 2)
    def _():
        return same(make(S, A0="=1+2*3").get_value("A0"), 7)

    @case("parentheses and left associativity", "baseline", 2)
    def _():
        s = make(S, A0="=(1+2)*3", A1="=10-4-3", A2="=100/10/5", A3="=2*(3+(4-1))")
        return [s.get_value(r) for r in ("A0", "A1", "A2", "A3")] == [9, 3, 2, 12]

    @case("decimals and unary minus", "baseline", 1)
    def _():
        s = make(S, A0="=1.5*2", A1="=-3+5", A2="=2*-4")
        return same(s.get_value("A0"), 3) and same(s.get_value("A1"), 2) and same(s.get_value("A2"), -8)

    @case("refs are case-insensitive, spaces ignored", "baseline", 1)
    def _():
        s = make(S, a0="4", B1="=  a0  *  2 ")
        return same(s.get_value("b1"), 8)

    # ---- core: chains and propagation --------------------------------------
    @case("chained refs (A3 = B3*B1 = 10)", "core", 3)
    def _():
        return same(make(S, B1="2", B3="5", A3="=B3 * B1").get_value("A3"), 10)

    @case("reference to a formula cell", "core", 3)
    def _():
        s = make(S, A0="2", A1="=A0*3", A2="=A1+A0", A3="=A2*A2")
        return [s.get_value(r) for r in ("A1", "A2", "A3")] == [6, 8, 64]

    @case("value change propagates (A0=5 -> A2=15)", "core", 3)
    def _():
        s = make(S, A0="4", A1="3", A2="=A1 * A0")
        s.set_cell("A0", "5")
        return same(s.get_value("A2"), 15)

    @case("propagates through a long chain", "core", 2)
    def _():
        s = S()
        s.set_cell("A0", "1")
        for i in range(1, 300):
            s.set_cell(f"A{i}", f"=A{i-1}+1")
        ok = same(s.get_value("A299"), 300)
        s.set_cell("A0", "10")
        return ok and same(s.get_value("A299"), 309)

    @case("formula defined before its inputs exist", "core", 2)
    def _():
        s = make(S, A2="=A0+A1")
        before = s.get_value("A2")
        s.set_cell("A0", "4")
        s.set_cell("A1", "6")
        return same(before, 0) and same(s.get_value("A2"), 10)

    @case("diamond dependency evaluates correctly", "core", 2)
    def _():
        s = make(S, A0="2", B0="=A0+1", C0="=A0*10", D0="=B0+C0")
        s.set_cell("A0", "3")
        return same(s.get_value("D0"), 34)

    @case("overwriting a formula with a number/text, and clearing", "core", 2)
    def _():
        s = make(S, A0="2", A1="=A0*5", A2="=A1+1")
        s.set_cell("A1", "100")
        ok = same(s.get_value("A2"), 101)
        s.set_cell("A1", "")
        return ok and same(s.get_value("A2"), 1)

    @case("errors: div by zero, bad syntax, text reference", "core", 3)
    def _():
        s = make(S, A0="=1/0", A1="=1+", A2="hello", A3="=A2+1", A4="=A0+1")
        return (s.get_value("A0") == "#DIV/0!" and s.get_value("A1") == "#ERR"
                and s.get_value("A2") == "hello" and s.get_value("A3") == "#VALUE!"
                and s.get_value("A4") == "#DIV/0!")

    # ---- hard: minimal recompute + cycles ----------------------------------
    @case("only downstream cells recompute", "hard", 4)
    def _():
        s = S()
        s.set_cell("A0", "1")
        s.set_cell("B0", "1")
        for i in range(1, 50):
            s.set_cell(f"B{i}", f"=B{i-1}+1")           # unrelated chain of 49 formulas
        s.set_cell("A1", "=A0+1")
        s.set_cell("A2", "=A1+1")
        before = s.eval_count
        s.set_cell("A0", "5")
        delta = s.eval_count - before
        return same(s.get_value("A2"), 7) and 2 <= delta <= 2

    @case("a diamond is evaluated once per cell, not once per path", "hard", 2)
    def _():
        s = S()
        s.set_cell("A0", "1")
        prev = ["A0"]
        for level in range(1, 11):                      # 10 levels of 2 cells, each reading both above
            cur = [f"{c}{level}" for c in "AB"]
            for c in cur:
                s.set_cell(c, "=" + "+".join(prev))
            prev = cur
        s.set_cell("C0", "=" + "+".join(prev))
        before = s.eval_count
        s.set_cell("A0", "2")
        return s.eval_count - before == 21              # 20 level cells + C0, each exactly once

    @case("2-cell cycle -> #CYCLE (no hang)", "hard", 4)
    def _():
        s = make(S, A0="=A1", A1="=A0")
        return s.get_value("A0") == "#CYCLE" and s.get_value("A1") == "#CYCLE"

    @case("self reference -> #CYCLE", "hard", 2)
    def _():
        return make(S, A0="=A0+1").get_value("A0") == "#CYCLE"

    @case("longer cycle, and cells downstream of it", "hard", 2)
    def _():
        s = make(S, A0="=A1+1", A1="=A2+1", A2="=A0+1", B0="=A0*2", C0="5")
        return (all(s.get_value(r) == "#CYCLE" for r in ("A0", "A1", "A2", "B0"))
                and same(s.get_value("C0"), 5))

    @case("breaking a cycle recovers", "hard", 3)
    def _():
        s = make(S, A0="=A1", A1="=A0")
        s.set_cell("A1", "7")
        return same(s.get_value("A0"), 7) and same(s.get_value("A1"), 7)

    @case("creating a cycle through an existing chain", "hard", 2)
    def _():
        s = make(S, A0="1", A1="=A0+1", A2="=A1+1")
        s.set_cell("A0", "=A2")
        return all(s.get_value(r) == "#CYCLE" for r in ("A0", "A1", "A2"))

    return C


class Timeout(Exception):
    pass


def _alarm(signum, frame):
    raise Timeout()


def main(path, per_case_seconds=5):
    try:
        S = load(path)
    except Exception as e:  # noqa: BLE001
        print(json.dumps({"loaded": False, "error": f"{type(e).__name__}: {e}"}))
        return
    results = []
    use_alarm = hasattr(signal, "SIGALRM")
    if use_alarm:
        signal.signal(signal.SIGALRM, _alarm)
    for name, tier, weight, fn in build_cases(S):
        ok, note = False, ""
        try:
            if use_alarm:
                signal.alarm(per_case_seconds)
            ok = bool(fn())
        except Timeout:
            note = "timeout (hang / infinite loop?)"
        except RecursionError:
            note = "recursion limit hit"
        except Exception as e:  # noqa: BLE001
            note = f"{type(e).__name__}: {e}"[:200]
        finally:
            if use_alarm:
                signal.alarm(0)
        results.append({"name": name, "tier": tier, "weight": weight, "passed": ok, "note": note})
    print(json.dumps({"loaded": True, "cases": results}))


if __name__ == "__main__":
    main(sys.argv[1])
