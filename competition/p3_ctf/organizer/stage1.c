/* Plain variant: password is a string literal (strings / ltrace / objdump all work). */
#include <stdio.h>
#include <string.h>

int main(void) {
    char buf[64];
    printf("Password: ");
    if (scanf("%63s", buf) != 1) return 1;
    if (strcmp(buf, "r3v3rs3_m3_pls") == 0)
        printf("flag{stage1_cleared_on_to_the_next}\n");
    else
        printf("Access denied\n");
    return 0;
}
