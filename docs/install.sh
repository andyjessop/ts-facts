#!/bin/sh
# ts-facts installer
#
# Usage:
#   curl -fsSL https://andyjessop.github.io/ts-facts/install.sh | sh
#
# Environment:
#   TS_FACTS_VERSION       Release tag (default: latest), e.g. v0.1.0
#   TS_FACTS_INSTALL_DIR   Install directory (default: $HOME/.local/bin)
#   TS_FACTS_REPO          GitHub repo (default: andyjessop/ts-facts)
#   TS_FACTS_DOWNLOAD_URL  Override binary download URL (for testing)
#   TS_FACTS_CHECKSUMS_URL Override checksums.txt URL (for testing)

set -eu

REPO="${TS_FACTS_REPO:-andyjessop/ts-facts}"
VERSION="${TS_FACTS_VERSION:-latest}"
INSTALL_DIR="${TS_FACTS_INSTALL_DIR:-${HOME}/.local/bin}"
BINARY_NAME="ts-facts"
DOWNLOAD_URL="${TS_FACTS_DOWNLOAD_URL:-}"
CHECKSUMS_URL="${TS_FACTS_CHECKSUMS_URL:-}"

say() {
	printf '%s\n' "$*"
}

err() {
	printf 'ts-facts install: %s\n' "$*" >&2
}

need_cmd() {
	if ! command -v "$1" >/dev/null 2>&1; then
		err "missing required command: $1"
		exit 1
	fi
}

detect_platform() {
	OS="$(uname -s)"
	ARCH="$(uname -m)"

	case "$OS-$ARCH" in
	Darwin-arm64 | Darwin-aarch64)
		PLATFORM="darwin-arm64"
		;;
	Darwin-x86_64)
		PLATFORM="darwin-x64"
		;;
	Linux-x86_64 | Linux-amd64)
		PLATFORM="linux-x64"
		;;
	Linux-aarch64 | Linux-arm64)
		PLATFORM="linux-arm64"
		;;
	*)
		err "unsupported platform: $OS $ARCH"
		err "download a release manually from https://github.com/${REPO}/releases"
		exit 1
		;;
	esac
}

download_url() {
	if [ -n "$DOWNLOAD_URL" ]; then
		printf '%s' "$DOWNLOAD_URL"
		return
	fi

	ASSET="ts-facts-${PLATFORM}"
	if [ "$VERSION" = "latest" ]; then
		printf 'https://github.com/%s/releases/latest/download/%s' "$REPO" "$ASSET"
	else
		printf 'https://github.com/%s/releases/download/%s/%s' "$REPO" "$VERSION" "$ASSET"
	fi
}

download() {
	URL="$1"
	DEST="$2"

	if command -v curl >/dev/null 2>&1; then
		curl -fsSL "$URL" -o "$DEST"
	elif command -v wget >/dev/null 2>&1; then
		wget -qO "$DEST" "$URL"
	else
		err "curl or wget is required"
		exit 1
	fi
}

verify_checksum() {
	CHECKSUMS_SOURCE=""
	if [ -n "$CHECKSUMS_URL" ]; then
		CHECKSUMS_SOURCE="$CHECKSUMS_URL"
	elif [ "$VERSION" = "latest" ]; then
		CHECKSUMS_SOURCE="https://github.com/${REPO}/releases/latest/download/checksums.txt"
	else
		CHECKSUMS_SOURCE="https://github.com/${REPO}/releases/download/${VERSION}/checksums.txt"
	fi

	TMP_DIR="$(mktemp -d)"
	trap 'rm -rf "$TMP_DIR"' EXIT INT HUP TERM

	if ! download "$CHECKSUMS_SOURCE" "$TMP_DIR/checksums.txt" 2>/dev/null; then
		return 0
	fi

	ASSET="ts-facts-${PLATFORM}"
	if command -v sha256sum >/dev/null 2>&1; then
		EXPECTED="$(grep " ${ASSET}$" "$TMP_DIR/checksums.txt" | awk '{print $1}')"
		ACTUAL="$(sha256sum "$INSTALL_PATH" | awk '{print $1}')"
	elif command -v shasum >/dev/null 2>&1; then
		EXPECTED="$(grep " ${ASSET}$" "$TMP_DIR/checksums.txt" | awk '{print $1}')"
		ACTUAL="$(shasum -a 256 "$INSTALL_PATH" | awk '{print $1}')"
	else
		return 0
	fi

	if [ -z "$EXPECTED" ]; then
		return 0
	fi

	if [ "$EXPECTED" != "$ACTUAL" ]; then
		err "checksum verification failed for ${ASSET}"
		rm -f "$INSTALL_PATH"
		exit 1
	fi
}

main() {
	need_cmd uname
	need_cmd mkdir
	need_cmd chmod

	detect_platform

	if [ ! -d "$INSTALL_DIR" ]; then
		mkdir -p "$INSTALL_DIR"
	fi

	INSTALL_PATH="${INSTALL_DIR}/${BINARY_NAME}"
	URL="$(download_url)"

	say "Installing ts-facts (${PLATFORM}) to ${INSTALL_PATH}"
	say "Downloading ${URL}"

	download "$URL" "$INSTALL_PATH"
	chmod +x "$INSTALL_PATH"
	verify_checksum

	if ! command -v "$BINARY_NAME" >/dev/null 2>&1; then
		case ":${PATH}:" in
		*":${INSTALL_DIR}:"*) ;;
		*)
			say ""
			say "Add ts-facts to your PATH:"
			say "  export PATH=\"${INSTALL_DIR}:\$PATH\""
			;;
		esac
	fi

	say ""
	say "Installed ts-facts successfully."
	say "Run: ts-facts --tsconfig ./tsconfig.json --out ./ts-static-facts.json"
}

main "$@"
