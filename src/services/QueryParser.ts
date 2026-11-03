/**
 * Query language lexer and parser.
 *
 * The syntax follows the Ants query grammar (ants-android `grammar/AntsQuery.g4`):
 *
 *   query       := expression EOF
 *   expression  := conjunction (OR conjunction)*
 *   conjunction := primary (AND? primary)*          -- a space means AND
 *   primary     := field ":(" expression ")"        -- scoped field, by:(alice OR bob)
 *                | field ":" value                  -- kind:1, by:"Derek Ross"
 *                | "(" expression ")"
 *                | "\"phrase\""
 *                | term
 *
 * AND binds tighter than OR, operators are case-insensitive whole words and
 * `NOT` is reserved. Inside quotes only `\"` and `\\` are valid escapes.
 *
 * This module only builds the syntax tree; `QueryPlanner` turns it into filters.
 */

export const MAX_QUERY_LENGTH = 2000;
export const MAX_GROUP_DEPTH = 16;
export const MAX_QUERY_NODES = 256;

/** A query that can't be parsed or planned. `position` is a UTF-16 index into the query */
export class QueryError extends Error {
  readonly position?: number;
  readonly length?: number;

  constructor(message: string, position?: number, length?: number) {
    super(message);
    this.name = "QueryError";
    this.position = position;
    this.length = length;
  }
}

export interface TermNode {
  type: "term";
  text: string;
  quoted: boolean;
  start: number;
  end: number;
}

export interface FieldNode {
  type: "field";
  /** Lowercased field name, without the colon */
  field: string;
  value: string;
  quoted: boolean;
  start: number;
  end: number;
}

export interface GroupNode {
  type: "and" | "or";
  children: QueryNode[];
}

export type QueryLeaf = TermNode | FieldNode;
export type QueryNode = QueryLeaf | GroupNode;

type TokenType = "word" | "string" | "lparen" | "rparen";

interface Token {
  type: TokenType;
  /** Raw text for words, unescaped contents for strings */
  value: string;
  start: number;
  end: number;
}

const WHITESPACE = /\s/;
const WORD_BREAK = /[\s()"\\]/;
const FIELD_NAME = /^[a-z][a-z0-9_-]*$/i;

function tokenize(query: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;

  while (i < query.length) {
    const char = query[i];

    if (WHITESPACE.test(char)) {
      i++;
    } else if (char === "(" || char === ")") {
      tokens.push({
        type: char === "(" ? "lparen" : "rparen",
        value: char,
        start: i,
        end: i + 1,
      });
      i++;
    } else if (char === '"') {
      const start = i;
      let value = "";
      i++;
      for (;;) {
        if (i >= query.length) {
          throw new QueryError("Unclosed quote", start, 1);
        }
        const c = query[i];
        if (c === '"') {
          i++;
          break;
        }
        if (c === "\\") {
          const next = query[i + 1];
          if (next !== '"' && next !== "\\") {
            throw new QueryError(
              'Only \\" and \\\\ can be escaped inside quotes',
              i,
              2,
            );
          }
          value += next;
          i += 2;
        } else if (c === "\r" || c === "\n") {
          throw new QueryError("Unclosed quote", start, 1);
        } else {
          value += c;
          i++;
        }
      }
      tokens.push({ type: "string", value, start, end: i });
    } else if (char === "\\") {
      throw new QueryError("Backslashes are only allowed inside quotes", i, 1);
    } else {
      const start = i;
      while (i < query.length && !WORD_BREAK.test(query[i])) i++;
      tokens.push({
        type: "word",
        value: query.slice(start, i),
        start,
        end: i,
      });
    }
  }

  return tokens;
}

function isOperator(token: Token | undefined, op: "OR" | "AND" | "NOT") {
  return token?.type === "word" && token.value.toUpperCase() === op;
}

/** Combine nodes into a group, flattening nested groups of the same type */
function group(type: "and" | "or", nodes: QueryNode[]): QueryNode {
  if (nodes.length === 1) return nodes[0];
  const children: QueryNode[] = [];
  for (const node of nodes) {
    if (node.type === type) children.push(...node.children);
    else children.push(node);
  }
  return { type, children };
}

/** Split a `name:value` word, or return null if it isn't a field */
function splitField(word: string): [string, string] | null {
  const colon = word.indexOf(":");
  if (colon <= 0) return null;
  const name = word.slice(0, colon);
  if (!FIELD_NAME.test(name)) return null;
  return [name.toLowerCase(), word.slice(colon + 1)];
}

class Parser {
  private pos = 0;
  private nodes = 0;
  private readonly tokens: Token[];
  private readonly length: number;

  constructor(tokens: Token[], length: number) {
    this.tokens = tokens;
    this.length = length;
  }

  parse(): QueryNode {
    const node = this.expression(0);
    const extra = this.peek();
    if (extra) {
      if (extra.type === "rparen") {
        throw new QueryError("Unmatched )", extra.start, 1);
      }
      throw new QueryError(`Unexpected "${extra.value}"`, extra.start);
    }
    return node;
  }

  private peek(offset = 0): Token | undefined {
    return this.tokens[this.pos + offset];
  }

  private next(): Token {
    return this.tokens[this.pos++];
  }

  private count() {
    if (++this.nodes > MAX_QUERY_NODES) {
      throw new QueryError(
        `Queries are limited to ${MAX_QUERY_NODES} terms and groups`,
      );
    }
  }

  /** True when the next token can't begin a primary */
  private atBoundary(): boolean {
    const token = this.peek();
    return (
      !token ||
      token.type === "rparen" ||
      isOperator(token, "OR") ||
      isOperator(token, "AND")
    );
  }

  private expectOperand(operator: Token) {
    if (this.atBoundary()) {
      throw new QueryError(
        `Expected a search term after ${operator.value.toUpperCase()}`,
        operator.start,
        operator.end - operator.start,
      );
    }
  }

  private expression(depth: number): QueryNode {
    const branches = [this.conjunction(depth)];
    while (isOperator(this.peek(), "OR")) {
      const op = this.next();
      this.expectOperand(op);
      branches.push(this.conjunction(depth));
    }
    if (branches.length > 1) this.count();
    return group("or", branches);
  }

  private conjunction(depth: number): QueryNode {
    const terms = [this.primary(depth)];
    for (;;) {
      const token = this.peek();
      if (!token || token.type === "rparen" || isOperator(token, "OR")) break;
      if (isOperator(token, "AND")) {
        const op = this.next();
        this.expectOperand(op);
      }
      terms.push(this.primary(depth));
    }
    if (terms.length > 1) this.count();
    return group("and", terms);
  }

  private primary(depth: number): QueryNode {
    const token = this.peek();

    if (!token) {
      throw new QueryError("Expected a search term", this.length);
    }
    if (isOperator(token, "NOT")) {
      throw new QueryError(
        "NOT isn't supported yet",
        token.start,
        token.end - token.start,
      );
    }
    if (isOperator(token, "OR") || isOperator(token, "AND")) {
      throw new QueryError(
        `${token.value.toUpperCase()} needs a search term on both sides`,
        token.start,
        token.end - token.start,
      );
    }
    if (token.type === "rparen") {
      throw new QueryError("Unmatched )", token.start, 1);
    }

    if (token.type === "lparen") {
      this.next();
      const inner = this.groupBody(token, depth);
      return inner;
    }

    this.next();
    this.count();

    if (token.type === "string") {
      return {
        type: "term",
        text: token.value,
        quoted: true,
        start: token.start,
        end: token.end,
      };
    }

    const field = splitField(token.value);
    if (!field) {
      return {
        type: "term",
        text: token.value,
        quoted: false,
        start: token.start,
        end: token.end,
      };
    }

    const [name, value] = field;
    if (value) {
      return {
        type: "field",
        field: name,
        value,
        quoted: false,
        start: token.start,
        end: token.end,
      };
    }

    // `name:` must be directly followed by a quoted value or a scoped group
    const following = this.peek();
    const adjacent = following && following.start === token.end;

    if (adjacent && following.type === "string") {
      this.next();
      if (!following.value) {
        throw new QueryError(
          `${name}: needs a value`,
          token.start,
          following.end - token.start,
        );
      }
      return {
        type: "field",
        field: name,
        value: following.value,
        quoted: true,
        start: token.start,
        end: following.end,
      };
    }

    if (adjacent && following.type === "lparen") {
      this.next();
      const inner = this.groupBody(following, depth);
      return this.scope(name, inner);
    }

    throw new QueryError(
      `${name}: needs a value`,
      token.start,
      token.end - token.start,
    );
  }

  /** Parse the inside of a group whose "(" was just consumed */
  private groupBody(open: Token, depth: number): QueryNode {
    if (depth + 1 > MAX_GROUP_DEPTH) {
      throw new QueryError(
        `Groups can only be nested ${MAX_GROUP_DEPTH} deep`,
        open.start,
        1,
      );
    }
    if (this.peek()?.type === "rparen") {
      throw new QueryError("Empty parentheses", open.start, 2);
    }
    const inner = this.expression(depth + 1);
    const close = this.peek();
    if (close?.type !== "rparen") {
      throw new QueryError("Missing )", open.start, 1);
    }
    this.next();
    return inner;
  }

  /** Push a scoped field name onto every term of `by:(alice OR bob)` */
  private scope(field: string, node: QueryNode): QueryNode {
    if (node.type === "field") {
      throw new QueryError(
        `${field}:(…) can only contain plain values`,
        node.start,
        node.end - node.start,
      );
    }
    if (node.type === "term") {
      return {
        type: "field",
        field,
        value: node.text,
        quoted: node.quoted,
        start: node.start,
        end: node.end,
      };
    }
    return {
      type: node.type,
      children: node.children.map((child) => this.scope(field, child)),
    };
  }
}

/** Parse a query string into a syntax tree. Throws `QueryError` */
export function parseQueryTree(query: string): QueryNode {
  if (query.length > MAX_QUERY_LENGTH) {
    throw new QueryError(
      `Queries are limited to ${MAX_QUERY_LENGTH} characters`,
      MAX_QUERY_LENGTH,
    );
  }
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    throw new QueryError("Enter something to search for", 0);
  }
  return new Parser(tokens, query.length).parse();
}

/** Every leaf of a tree, in source order */
export function queryLeaves(node: QueryNode): QueryLeaf[] {
  if ("children" in node) {
    return node.children.flatMap(queryLeaves);
  }
  return [node];
}
