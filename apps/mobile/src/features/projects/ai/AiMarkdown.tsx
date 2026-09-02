import { useMemo, useRef } from "react";
import { ScrollView, Text, View } from "react-native";
import {
  getMarkdown,
  parseMarkdownToStructure,
  type BaseNode,
  type ParsedNode,
} from "stream-markdown-parser";
import type { MarkdownIt } from "stream-markdown-parser";

import { aiStyles } from "./ai-chrome";

type AiMarkdownProps = {
  content: string;
  streaming?: boolean;
};

type RenderNode = {
  type: string;
  raw: string;
  children?: ParsedNode[];
  level?: number;
  items?: RenderNode[];
  ordered?: boolean;
  start?: number;
  header?: RenderNode | boolean;
  rows?: RenderNode[];
  cells?: RenderNode[];
  checked?: boolean;
  alt?: string;
  src?: string;
  text?: string;
  content?: string;
  code?: string;
};

type NodeProps = {
  node: ParsedNode;
  keyPath: string;
};

function nodeText(node: BaseNode): string {
  const value = node as RenderNode;
  if (typeof value.content === "string") {
    return value.content;
  }
  if (typeof value.text === "string") {
    return value.text;
  }
  if (typeof value.code === "string") {
    return value.code;
  }
  if (value.children) {
    return value.children.map((child) => nodeText(child)).join("");
  }
  return value.raw;
}

function InlineChildren({ nodes, keyPrefix }: { nodes: ParsedNode[]; keyPrefix: string }) {
  return nodes.map((node, index) => (
    <MarkdownNode
      key={`${keyPrefix}-${index}`}
      node={node}
      keyPath={`${keyPrefix}-${index}`}
      inline
    />
  ));
}

function MarkdownNode({
  node: rawNode,
  keyPath,
  inline = false,
}: NodeProps & { inline?: boolean }) {
  const node = rawNode as RenderNode;
  switch (node.type) {
    case "text":
      return <Text>{node.content ?? ""}</Text>;
    case "strong":
      return (
        <Text style={aiStyles.strong}>
          <InlineChildren nodes={node.children ?? []} keyPrefix={keyPath} />
        </Text>
      );
    case "emphasis":
      return (
        <Text style={aiStyles.emphasis}>
          <InlineChildren nodes={node.children ?? []} keyPrefix={keyPath} />
        </Text>
      );
    case "strikethrough":
      return (
        <Text style={aiStyles.strikethrough}>
          <InlineChildren nodes={node.children ?? []} keyPrefix={keyPath} />
        </Text>
      );
    case "inline_code":
      return <Text style={aiStyles.inlineCode}>{node.code}</Text>;
    case "link":
      return (
        <Text style={aiStyles.link}>
          <InlineChildren nodes={node.children ?? []} keyPrefix={keyPath} />
        </Text>
      );
    case "hardbreak":
      return <Text>{"\n"}</Text>;
    case "paragraph":
    case "inline":
      return (
        <Text style={inline ? undefined : aiStyles.paragraph}>
          <InlineChildren nodes={node.children ?? []} keyPrefix={keyPath} />
        </Text>
      );
    case "heading":
      return (
        <Text
          style={
            node.level === 1
              ? aiStyles.heading1
              : node.level === 2
                ? aiStyles.heading2
                : aiStyles.heading3
          }
        >
          <InlineChildren nodes={node.children ?? []} keyPrefix={keyPath} />
        </Text>
      );
    case "blockquote":
      return (
        <View style={aiStyles.blockquote}>
          {(node.children ?? []).map((child, index) => (
            <MarkdownNode
              key={`${keyPath}-${index}`}
              node={child}
              keyPath={`${keyPath}-${index}`}
            />
          ))}
        </View>
      );
    case "list":
      return (
        <View style={aiStyles.listBlock}>
          {(node.items ?? []).map((item, index) => (
            <View key={`${keyPath}-${index}`} style={aiStyles.listItem}>
              <Text style={aiStyles.listMarker}>
                {node.ordered ? `${(node.start ?? 1) + index}.` : "•"}
              </Text>
              <View style={aiStyles.listItemBody}>
                {(item.children ?? []).map((child, childIndex) => (
                  <MarkdownNode
                    key={`${keyPath}-${index}-${childIndex}`}
                    node={child}
                    keyPath={`${keyPath}-${index}-${childIndex}`}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>
      );
    case "code_block": {
      const code = (node.code ?? "").replace(/\n+$/, "");
      return (
        <ScrollView
          style={aiStyles.codeBlock}
          contentContainerStyle={aiStyles.codeContent}
          nestedScrollEnabled
        >
          <Text
            selectable
            style={aiStyles.codeText}
            textBreakStrategy="simple"
            android_hyphenationFrequency="none"
          >
            {code || " "}
          </Text>
        </ScrollView>
      );
    }
    case "thematic_break":
      return <View style={aiStyles.thematicBreak} />;
    case "table": {
      const headerNode = typeof node.header === "object" ? node.header : undefined;
      const headers = headerNode?.cells ?? [];
      return (
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={aiStyles.tableCard}>
            {(node.rows ?? []).map((row, rowIndex) => (
              <View
                key={`${keyPath}-row-${rowIndex}`}
                style={[aiStyles.tableCardRow, rowIndex > 0 && aiStyles.tableCardRowDivider]}
              >
                {(row.cells ?? []).map((cell, cellIndex) => (
                  <View key={`${keyPath}-${rowIndex}-${cellIndex}`} style={aiStyles.tableCardField}>
                    <Text style={aiStyles.tableCardLabel}>
                      <InlineChildren
                        nodes={headers[cellIndex]?.children ?? []}
                        keyPrefix={`${keyPath}-header-${cellIndex}`}
                      />
                    </Text>
                    <Text style={aiStyles.tableCardValue}>
                      <InlineChildren
                        nodes={cell.children ?? []}
                        keyPrefix={`${keyPath}-${rowIndex}-${cellIndex}`}
                      />
                    </Text>
                  </View>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      );
    }
    case "table_row":
      return null;

    case "image":
      return <Text style={aiStyles.metaText}>[图片: {node.alt || node.src}]</Text>;
    case "checkbox":
    case "checkbox_input":
      return <Text style={aiStyles.messageText}>{node.checked ? "☑" : "☐"}</Text>;
    case "html_block":
    case "html_inline":
      return <Text>{nodeText(node)}</Text>;
    default:
      return <Text>{nodeText(node)}</Text>;
  }
}

export function AiMarkdown({ content, streaming = false }: AiMarkdownProps) {
  const parserRef = useRef<MarkdownIt | null>(null);
  if (parserRef.current === null) {
    parserRef.current = getMarkdown("mobile-ai");
  }
  const nodes = useMemo(
    () =>
      content === ""
        ? []
        : parseMarkdownToStructure(content, parserRef.current!, {
            final: !streaming,
            streamParse: "auto",
            reuseStableTopLevelNodes: true,
            validateLink: (url) => /^(https?:|mailto:)/i.test(url),
          }),
    [content, streaming],
  );

  return (
    <View style={aiStyles.markdown}>
      {nodes.map((node, index) => (
        <MarkdownNode key={`node-${index}`} node={node} keyPath={`node-${index}`} />
      ))}
      {streaming && content !== "" ? <Text style={aiStyles.streamingCursor}>▍</Text> : null}
    </View>
  );
}
