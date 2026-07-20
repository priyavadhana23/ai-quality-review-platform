import React from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark, oneLight } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Box, useTheme } from "@mui/material";
import type { Components } from "react-markdown";

interface MarkdownRendererProps {
  content: string;
}

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const theme = useTheme();
  const isDark = theme.palette.mode === "dark";

  const components: Components = {
    code({ className, children, ...rest }) {
      const match = /language-(\w+)/.exec(className ?? "");
      const isBlock = !!match || String(children).includes("\n");
      if (isBlock) {
        return (
          <SyntaxHighlighter
            style={isDark ? oneDark : oneLight}
            language={match?.[1] ?? "text"}
            PreTag="div"
            customStyle={{ borderRadius: 6, fontSize: 13, margin: "12px 0" }}
          >
            {String(children).replace(/\n$/, "")}
          </SyntaxHighlighter>
        );
      }
      return (
        <code
          style={{
            background: isDark ? "#161b22" : "#f6f8fa",
            border: `1px solid ${theme.palette.divider}`,
            borderRadius: "4px",
            padding: "1px 5px",
            fontSize: "0.85em",
            fontFamily: "monospace",
          }}
          {...rest}
        >
          {children}
        </code>
      );
    },
    table({ children }) {
      return (
        <Box sx={{ overflowX: "auto", my: 2 }}>
          <Box
            component="table"
            sx={{
              width: "100%",
              borderCollapse: "collapse",
              fontSize: 14,
              "& th, & td": {
                border: `1px solid ${theme.palette.divider}`,
                px: 1.5,
                py: 0.75,
                textAlign: "left",
              },
              "& thead": { bgcolor: isDark ? "#21262d" : "#f6f8fa" },
              "& tbody tr:nth-of-type(even)": {
                bgcolor: isDark ? "#161b2280" : "#f6f8fa80",
              },
            }}
          >
            {children}
          </Box>
        </Box>
      );
    },
    blockquote({ children }) {
      return (
        <Box
          component="blockquote"
          sx={{
            borderLeft: `4px solid ${theme.palette.primary.main}`,
            pl: 2,
            ml: 0,
            my: 1.5,
            color: "text.secondary",
            fontStyle: "italic",
          }}
        >
          {children}
        </Box>
      );
    },
    a({ href, children }) {
      return (
        <Box
          component="a"
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          sx={{
            color: "primary.main",
            textDecoration: "none",
            "&:hover": { textDecoration: "underline" },
          }}
        >
          {children}
        </Box>
      );
    },
  };

  return (
    <Box
      sx={{
        "& h1, & h2, & h3, & h4, & h5, & h6": {
          mt: 2.5,
          mb: 1,
          fontWeight: 600,
          color: "text.primary",
        },
        "& p": { my: 1, lineHeight: 1.7 },
        "& ul, & ol": { pl: 2.5 },
        "& li": { my: 0.5, lineHeight: 1.7 },
        "& hr": { border: "none", borderTop: `1px solid ${theme.palette.divider}`, my: 2 },
        color: "text.primary",
        fontSize: 14,
      }}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw]}
        components={components}
      >
        {content}
      </ReactMarkdown>
    </Box>
  );
};
