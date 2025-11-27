package main

import (
	"bufio"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"sort"
	"strings"
)

var ignoreDirNames = map[string]bool{
	".git":         true,
	".idea":        true,
	".vscode":      true,
	"node_modules": true,
	"dist":         true,
	"bin":          true,
	".DS_Store":    true,
}

var ignoreFileNames = map[string]bool{
	".DS_Store": true,
}

const (
	connMid  = "├── "
	connLast = "└── "
	vert     = "│   "
	space    = "    "
)

func main() {
	root := "."
	if len(os.Args) > 1 && !strings.HasSuffix(strings.ToLower(os.Args[1]), ".txt") {
		root = os.Args[1]
	}
	outPath := "tree_output.txt"
	if len(os.Args) > 1 && strings.HasSuffix(strings.ToLower(os.Args[len(os.Args)-1]), ".txt") {
		outPath = os.Args[len(os.Args)-1]
	}

	// Construir salida en memoria
	var b strings.Builder
	if err := buildTree(&b, root); err != nil {
		fmt.Fprintf(os.Stderr, "error: %v\n", err)
		os.Exit(1)
	}

	// Imprimir a consola (UTF-8)
	fmt.Print(b.String())

	// Escribir a archivo en UTF-8 con BOM para máxima compatibilidad en Windows
	if err := writeUTF8WithBOM(outPath, b.String()); err != nil {
		fmt.Fprintf(os.Stderr, "error writing file: %v\n", err)
		os.Exit(1)
	} else {
		fmt.Fprintf(os.Stderr, "saved: %s\n", outPath)
	}
}

func buildTree(w io.Writer, root string) error {
	fmt.Fprintf(w, "%s/\n", filepath.Clean(root))
	return walk(w, root, "", true)
}

func walk(w io.Writer, dir, prefix string, isRoot bool) error {
	entries, err := os.ReadDir(dir)
	if err != nil {
		return err
	}

	var dirs, files []fs.DirEntry
	for _, e := range entries {
		name := e.Name()
		if e.IsDir() {
			if ignoreDirNames[name] {
				continue
			}
			dirs = append(dirs, e)
		} else {
			if ignoreFileNames[name] {
				continue
			}
			files = append(files, e)
		}
	}
	sort.Slice(dirs, func(i, j int) bool { return strings.ToLower(dirs[i].Name()) < strings.ToLower(dirs[j].Name()) })
	sort.Slice(files, func(i, j int) bool { return strings.ToLower(files[i].Name()) < strings.ToLower(files[j].Name()) })

	total := len(dirs) + len(files)
	count := 0

	for _, d := range dirs {
		count++
		isLast := (count == total) && (len(files) == 0)
		connector, nextPrefix := connMid, prefix+vert
		if isLast {
			connector, nextPrefix = connLast, prefix+space
		}
		fmt.Fprintf(w, "%s%s%s/\n", prefix, connector, d.Name())
		if err := walk(w, filepath.Join(dir, d.Name()), nextPrefix, false); err != nil {
			return err
		}
	}
	for i, f := range files {
		connector := connMid
		if i == len(files)-1 {
			connector = connLast
		}
		fmt.Fprintf(w, "%s%s%s\n", prefix, connector, f.Name())
	}
	return nil
}

func writeUTF8WithBOM(path string, content string) error {
	f, err := os.Create(path)
	if err != nil {
		return err
	}
	defer f.Close()

	w := bufio.NewWriter(f)
	// BOM para UTF-8
	if _, err := w.Write([]byte{0xEF, 0xBB, 0xBF}); err != nil {
		return err
	}
	if _, err := w.WriteString(content); err != nil {
		return err
	}
	return w.Flush()
}
