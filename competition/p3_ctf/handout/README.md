# Problem 3 — CTF: pull the password out of the binary

Two Linux x86-64 binaries are provided:

* `stage1` — the main challenge.
* `stage1_xor` — the **bonus** variant (stripped, obfuscated: plain `strings` will not help).

```
chmod +x stage1 stage1_xor
./stage1            # asks "Password:" ; wrong input prints "Access denied"
```

The correct password is hidden inside the binary. Recover it **statically or dynamically**
and use it to reveal the flag. Brute-forcing the input is not allowed (and is too slow anyway).
Only run these on a machine you own (WSL / a Linux VM / Docker are fine).

Useful tools: `strings`, `ltrace`, `objdump -d`, Ghidra, `gdb`.

## Submit
* the password, the flag (`flag{...}`), and a short note naming the technique you used and why it works;
* optionally the same for `stage1_xor` for bonus points.
