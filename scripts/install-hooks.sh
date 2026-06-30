#!/bin/sh
# 安装 .git/hooks/pre-commit,调 scripts/gate-spec-coverage(spec-coverage 门)。
# 幂等:重复运行只覆盖成同一内容,可安全重装。
set -e
ROOT="$(git rev-parse --show-toplevel)"
HOOK_DIR="$ROOT/.git/hooks"
HOOK="$HOOK_DIR/pre-commit"
mkdir -p "$HOOK_DIR"

cat > "$HOOK" <<EOF
#!/bin/sh
# 由 scripts/install-hooks.sh 安装;spec-coverage 门(spec-first 覆盖)。
exec "\$(git rev-parse --show-toplevel)/scripts/gate-spec-coverage"
EOF
chmod +x "$HOOK"
chmod +x "$ROOT/scripts/gate-spec-coverage"
echo "[install-hooks] pre-commit 钩子已安装 → scripts/gate-spec-coverage"
echo "  卸载:rm .git/hooks/pre-commit"
