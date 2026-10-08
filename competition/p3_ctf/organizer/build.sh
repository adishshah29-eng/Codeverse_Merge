#!/usr/bin/env bash
# Rebuild both binaries into ../handout (Linux x86_64). Run from anywhere.
set -euo pipefail
cd "$(dirname "$0")"
python3 gen_xor.py > stage1_xor.c
gcc -O0 -fno-stack-protector -o ../handout/stage1 stage1.c
gcc -O0 -fno-stack-protector -o ../handout/stage1_xor stage1_xor.c
strip ../handout/stage1_xor
echo "built: $(ls -l ../handout/stage1 ../handout/stage1_xor | awk '{print $9, $5}')"
