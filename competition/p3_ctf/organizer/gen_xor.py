"""Generate stage1_xor.c: password AND flag are XOR-obfuscated so `strings` shows neither.

    python3 gen_xor.py > stage1_xor.c
"""
KEY = 0x5A
PASSWORD = "r3v3rs3_m3_pls"
FLAG = "flag{stage1_cleared_on_to_the_next}"


def arr(s):
    return ", ".join(f"0x{ord(c) ^ KEY:02x}" for c in s)


print(f"""/* XOR variant: nothing readable in .rodata; decode happens at runtime. */
#include <stdio.h>
#include <string.h>

static const unsigned char P[] = {{ {arr(PASSWORD)} }};
static const unsigned char F[] = {{ {arr(FLAG)} }};

static void dec(const unsigned char *in, size_t n, char *out) {{
    for (size_t i = 0; i < n; i++) out[i] = (char)(in[i] ^ 0x{KEY:02X});
    out[n] = 0;
}}

int main(void) {{
    char buf[64], pw[64], flag[96];
    dec(P, sizeof P, pw);
    printf("Password: ");
    if (scanf("%63s", buf) != 1) return 1;
    if (strcmp(buf, pw) == 0) {{
        dec(F, sizeof F, flag);
        printf("%s\\n", flag);
    }} else
        printf("Access denied\\n");
    return 0;
}}""")
