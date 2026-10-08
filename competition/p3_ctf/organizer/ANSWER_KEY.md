# Problem 3 — Answer key (organizer only)

| Binary | Password | Flag |
|---|---|---|
| `stage1` | `r3v3rs3_m3_pls` | `flag{stage1_cleared_on_to_the_next}` |
| `stage1_xor` | `r3v3rs3_m3_pls` | `flag{stage1_cleared_on_to_the_next}` |

Solution paths: `strings stage1 | grep -i flag`; `ltrace ./stage1` (shows the `strcmp` arguments);
Ghidra/`objdump -d` to read the literal. For `stage1_xor` the password and flag are XOR 0x5A in `.rodata`
and decoded at runtime, so `strings` is useless — break on `strcmp` in gdb (`b strcmp`, `x/s $rsi`),
use `ltrace`, or decode the bytes by hand.

Rebuild with `organizer/build.sh` (source: `stage1.c`, generator `gen_xor.py`).
The password/flag are held by the platform in `backend/app/phase1/games/g3_ctf.py` (CTF_PASSWORD / CTF_FLAG).
