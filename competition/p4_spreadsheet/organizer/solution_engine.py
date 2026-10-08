"""Reference formula engine (organizer only)."""
import re

_REF = re.compile(r"[A-Z]+[0-9]+")
_TOKEN = re.compile(r"\s*(?:(\d+\.?\d*|\.\d+)|([A-Za-z]+[0-9]+)|(.))")
_NUM = re.compile(r"^\s*[-+]?(\d+\.?\d*|\.\d+)\s*$")


class _Err(Exception):
    def __init__(self, code):
        self.code = code


def _tokenize(src):
    out, pos = [], 0
    src = src.rstrip()
    while pos < len(src):
        m = _TOKEN.match(src, pos)
        if not m:
            raise _Err("#ERR")
        num, ref, op = m.groups()
        if num is not None:
            out.append(("num", float(num)))
        elif ref is not None:
            out.append(("ref", ref.upper()))
        elif op in "+-*/()":
            out.append(("op", op))
        else:
            raise _Err("#ERR")
        pos = m.end()
    return out


class _Parser:
    """expr := term (('+'|'-') term)* ; term := unary (('*'|'/') unary)* ;
    unary := '-' unary | '+' unary | atom ; atom := num | ref | '(' expr ')'"""

    def __init__(self, tokens):
        self.t, self.i = tokens, 0

    def peek(self):
        return self.t[self.i] if self.i < len(self.t) else (None, None)

    def eat(self):
        tok = self.peek()
        self.i += 1
        return tok

    def parse(self):
        node = self.expr()
        if self.i != len(self.t):
            raise _Err("#ERR")
        return node

    def expr(self):
        node = self.term()
        while self.peek() in (("op", "+"), ("op", "-")):
            op = self.eat()[1]
            node = ("bin", op, node, self.term())
        return node

    def term(self):
        node = self.unary()
        while self.peek() in (("op", "*"), ("op", "/")):
            op = self.eat()[1]
            node = ("bin", op, node, self.unary())
        return node

    def unary(self):
        if self.peek() in (("op", "-"), ("op", "+")):
            op = self.eat()[1]
            inner = self.unary()
            return ("neg", inner) if op == "-" else inner
        return self.atom()

    def atom(self):
        kind, val = self.eat()
        if kind == "num":
            return ("num", val)
        if kind == "ref":
            return ("ref", val)
        if (kind, val) == ("op", "("):
            node = self.expr()
            if self.eat() != ("op", ")"):
                raise _Err("#ERR")
            return node
        raise _Err("#ERR")


def _refs(node, acc):
    if node[0] == "ref":
        acc.add(node[1])
    elif node[0] == "bin":
        _refs(node[2], acc)
        _refs(node[3], acc)
    elif node[0] == "neg":
        _refs(node[1], acc)
    return acc


def _tidy(x):
    return int(x) if isinstance(x, float) and x.is_integer() else x


class Spreadsheet:
    def __init__(self):
        self._raw = {}
        self._ast = {}        # formula cells: ref -> AST, or an error code string
        self._deps = {}       # ref -> set of refs it reads
        self._users = {}      # ref -> set of refs that read it (dependents)
        self._val = {}
        self.eval_count = 0

    @staticmethod
    def _norm(ref):
        return ref.strip().upper()

    # ---- public ----------------------------------------------------------
    def get_raw(self, ref):
        return self._raw.get(self._norm(ref), "")

    def get_value(self, ref):
        ref = self._norm(ref)
        if ref in self._val:
            return self._val[ref]
        return "" if ref not in self._raw else self._plain(self._raw[ref])

    def set_cell(self, ref, raw):
        ref = self._norm(ref)
        raw = "" if raw is None else str(raw)
        for d in self._deps.pop(ref, ()):           # drop old dependency edges
            self._users.get(d, set()).discard(ref)
        self._ast.pop(ref, None)
        self._val.pop(ref, None)
        if raw == "":
            self._raw.pop(ref, None)
        else:
            self._raw[ref] = raw
            if raw.lstrip().startswith("="):
                try:
                    tree = _Parser(_tokenize(raw.lstrip()[1:])).parse()
                    deps = _refs(tree, set())
                    self._ast[ref] = tree
                    self._deps[ref] = deps
                    for d in deps:
                        self._users.setdefault(d, set()).add(ref)
                except _Err as e:
                    self._ast[ref] = e.code
        self._recompute(ref)

    # ---- internals -------------------------------------------------------
    @staticmethod
    def _plain(raw):
        return _tidy(float(raw)) if _NUM.match(raw) else raw

    def _affected(self, start):
        seen, stack = {start}, [start]
        while stack:
            for u in self._users.get(stack.pop(), ()):
                if u not in seen:
                    seen.add(u)
                    stack.append(u)
        return seen

    def _recompute(self, start):
        affected = self._affected(start)
        # Kahn's algorithm restricted to the affected sub-graph.
        indeg = {c: sum(1 for d in self._deps.get(c, ()) if d in affected) for c in affected}
        ready = [c for c, n in indeg.items() if n == 0]
        done = set()
        while ready:
            c = ready.pop()
            done.add(c)
            self._eval_cell(c)
            for u in self._users.get(c, ()):
                if u in indeg:
                    indeg[u] -= 1
                    if indeg[u] == 0:
                        ready.append(u)
        for c in affected - done:       # never became ready: on or behind a cycle
            self._val[c] = "#CYCLE"

    def _eval_cell(self, c):
        raw = self._raw.get(c)
        if c not in self._ast:
            if raw is None:
                self._val.pop(c, None)
            else:
                self._val[c] = self._plain(raw)
            return
        self.eval_count += 1
        tree = self._ast[c]
        if isinstance(tree, str):
            self._val[c] = tree
            return
        try:
            self._val[c] = _tidy(self._ev(tree))
        except _Err as e:
            self._val[c] = e.code
        except ZeroDivisionError:
            self._val[c] = "#DIV/0!"

    def _ev(self, node):
        kind = node[0]
        if kind == "num":
            return node[1]
        if kind == "ref":
            v = self.get_value(node[1])
            if v == "":
                return 0
            if isinstance(v, str):
                raise _Err(v if v.startswith("#") else "#VALUE!")
            return v
        if kind == "neg":
            return -self._ev(node[1])
        a, b = self._ev(node[2]), self._ev(node[3])
        op = node[1]
        return a + b if op == "+" else a - b if op == "-" else a * b if op == "*" else a / b
