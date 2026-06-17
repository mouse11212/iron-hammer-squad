#!/usr/bin/env bash
# 铁锤小队 · 离线技能安装器
# 把本包内 vendored 的技能/工具安装到目标仓库的「项目级」.claude/，全程无需联网。
#
# 用法:
#   ./install-offline.sh [目标仓库路径]        # 默认安装 OpenSpec + gstack
#   ./install-offline.sh [目标仓库路径] --with-plugins   # 额外链入 superpowers/frontend-design/claude-obsidian
#
# 注意:
#   - superpowers/frontend-design/claude-obsidian 若目标机已全局安装(插件)，加 --with-plugins 会与全局重名，按需使用。
#   - gstack 浏览器类工具(/qa /browse)需 bun 构建 browse 二进制(本包未含)，方法论类技能开箱即用。
set -e

PKG="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET="$(pwd)"
WITH_PLUGINS=0
for a in "$@"; do
  case "$a" in
    --with-plugins) WITH_PLUGINS=1 ;;
    -*) echo "未知参数: $a" >&2; exit 1 ;;
    *) TARGET="$a" ;;
  esac
done

echo "▶ 安装目标: $TARGET"
mkdir -p "$TARGET/.claude/skills"

# 1) OpenSpec —— 用 vendored 预构建 CLI 生成 .claude 命令/技能(离线)
if [ ! -d "$PKG/skills/openspec/dist" ]; then
  echo "✗ OpenSpec 未构建(缺 dist/)。先在联网机: cd skills/openspec && npm install && node build.js" >&2
  exit 1
fi
echo "▶ 安装 OpenSpec (生成 .claude/commands/opsx + skills + openspec/ 脚手架)"
CI=true node "$PKG/skills/openspec/bin/openspec.js" init "$TARGET" --tools claude --force

# 2) gstack —— 项目级技能(符号链接到离线源)
echo "▶ 安装 gstack -> $TARGET/.claude/skills/gstack"
ln -sfn "$PKG/skills/gstack" "$TARGET/.claude/skills/gstack"

# 3) 可选: 其余 Claude Code 插件
if [ "$WITH_PLUGINS" -eq 1 ]; then
  for p in superpowers frontend-design claude-obsidian; do
    echo "▶ 链入插件 $p"
    ln -sfn "$PKG/skills/$p" "$TARGET/.claude/skills/$p"
  done
fi

echo
echo "✔ 完成。把 openspec 加入 PATH:"
echo "    export PATH=\"$PKG/bin:\$PATH\""
echo "  验证: openspec --version"
echo
echo "ℹ gstack 浏览器工具如需启用: 装 bun 后 cd \"$PKG/skills/gstack\" && ./setup --local (在目标仓库内运行)"
