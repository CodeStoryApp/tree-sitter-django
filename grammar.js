/**
 * @file Django template parser
 * @author Dominique PERETTI
 * @license MIT
 */

/// <reference types="tree-sitter-cli/dsl" />
// @ts-check

// https://tree-sitter.github.io/tree-sitter/creating-parsers#the-grammar-dsl
module.exports = grammar({
  name: "django",

  word: ($) => $._identifier,

  // Exclude new lines from default whitespace matching, otherwise the statements preceding lines
  // are matched as being part of the statement.
  extras: ($) => [' ', '\t'],

  rules: {
    // Root rule - a template consists of repeated nodes
    template: ($) => repeat($._node),

    // A node can be an expression {{var}}, statement {%tag%}, comment {#...#}, or plain content
    _node: ($) => choice($.expression, $._statement, $._comment, $.content),

    _identifier: ($) => /\w+/,

    // Basic building blocks used throughout the grammar
    keyword: ($) =>
      token(
        seq(
          choice(
            "on",
            "off",
            "with",
            "as",
            "silent",
            "only",
            "from",
            "random",
            "by",
          ),
          /\s/,
        ),
      ),
    keyword_operator: ($) =>
      token(
        seq(choice("and", "or", "not", "in", "not in", "is", "is not"), /\s/),
      ),
    operator: ($) => choice("==", "!=", "<", ">", "<=", ">="),
    number: ($) => /[0-9]+/,
    boolean: ($) => token(seq(choice("True", "False"), /\s/)),
    string: ($) =>
      seq(
        choice(seq("'", repeat(/[^']/), "'"), seq('"', repeat(/[^"]/), '"')),
        repeat(seq("|", $.filter)),
      ),

    // Expressions
    expression: ($) => seq("{{", $.variable, "}}"),

    // Variables can have optional filters: my_var|upper|lower:"arg"
    variable: ($) => seq($.variable_name, repeat(seq("|", $.filter))),

    // Django variables: must start with letter, can have dots (user.name.first)
    // Cannot start with "_", can contain one or more words separated by a "."
    variable_name: ($) => /[a-zA-Z](\w+)?((\.?\w)+)?/,

    filter: ($) =>
      seq(
        $.filter_name,
        optional(
          seq(":", choice($.filter_argument, $._quoted_filter_argument)),
        ),
      ),
    filter_name: ($) => $._identifier,
    filter_argument: ($) => seq($._identifier, repeat(seq(".", $._identifier))),
    _quoted_filter_argument: ($) =>
      choice(
        seq("'", alias(repeat(/[^']/), $.filter_argument), "'"),
        seq('"', alias(repeat(/[^"]/), $.filter_argument), '"'),
      ),

    // Django template statements come in two forms:
    // 1. Unpaired tags: {% csrf_token %}, {% include "template.html" %}
    // 2. Paired tags: {% if foo %}...{% endif %}, {% block content %}...{% endblock %}
    _statement: ($) =>
      choice(
        $.paired_statement,
        alias($.if_statement, $.paired_statement),
        alias($.for_statement, $.paired_statement),
        alias($.filter_statement, $.paired_statement),
        $.unpaired_statement,
      ),

    paired_statement: ($) => {
      const tag_names = [
        "autoescape",
        "block",
        "blocktranslate",
        "ifchanged",
        "spaceless",
        "verbatim",
        "with",
      ];

      return choice(
        ...tag_names.map((tag_name) =>
          seq(
            "{%",
            alias(tag_name, $.tag_name),
            repeat($._attribute),
            "%}",
            repeat($._node),
            "{%",
            alias("end" + tag_name, $.tag_name),
            repeat($._attribute),
            alias("%}", $.end_paired_statement),
          ),
        ),
      );
    },

    // Full if/elif/else control structure
    // {% if condition %}
    //   ...
    // {% elif condition %}
    //   ...
    // {% else %}
    //   ...
    // {% endif %}
    if_statement: ($) =>
      seq(
        "{%",
        alias("if", $.tag_name),
        repeat($._attribute),  // Conditions and operators
        "%}",
        repeat($._node),      // Content inside if block
        repeat(
          prec.left(
            seq(alias($.elif_statement, $.branch_statement), repeat($._node)),
          ),
        ),
        optional(
          seq(alias($.else_statement, $.branch_statement), repeat($._node)),
        ),
        "{%",
        alias("endif", $.tag_name),
        alias("%}", $.end_paired_statement),
      ),
    elif_statement: ($) =>
      seq("{%", alias("elif", $.tag_name), repeat($._attribute), "%}"),
    else_statement: ($) => seq("{%", alias("else", $.tag_name), "%}"),

    for_statement: ($) =>
      seq(
        "{%",
        alias("for", $.tag_name),
        repeat($._attribute),
        "%}",
        repeat($._node),
        optional(
          seq(alias($.empty_statement, $.branch_statement), repeat($._node)),
        ),
        "{%",
        alias("endfor", $.tag_name),
        alias("%}", $.end_paired_statement),
      ),
    empty_statement: ($) =>
      seq("{%", alias("empty", $.tag_name), repeat($._attribute), "%}"),

    filter_statement: ($) =>
      seq(
        "{%",
        alias("filter", $.tag_name),
        $.filter,
        repeat(seq("|", $.filter)),
        "%}",
        repeat($._node),
        "{%",
        alias("endfilter", $.tag_name),
        alias("%}", $.end_paired_statement),
      ),
    unpaired_statement: ($) =>
      seq("{%", alias($._identifier, $.tag_name), repeat($._attribute), "%}"),

    // Attributes can appear in tag arguments: {% for x in items reversed %}
    // They can be keywords, operators, variables, literals, etc.
    // Optionally followed by comma or equals sign
    _attribute: ($) =>
      seq(
        choice(
          $.keyword,
          $.operator,
          $.keyword_operator,
          $.number,
          $.boolean,
          $.string,
          $.variable,
        ),
        optional(choice(",", "=")),
      ),

    // Django supports two types of comments:
    // 1. Single-line: {# This is a comment #}
    // 2. Multi-line: {% comment %}
    //                  This is a longer comment
    //                  that can span multiple lines
    //                {% endcomment %}
    _comment: ($) => choice($.unpaired_comment, $.paired_comment),
    unpaired_comment: ($) =>
      seq(
        "{#",
        repeat(/.|\s/),
        repeat(seq(alias($.unpaired_comment, ""), repeat(/.|\s/))),
        "#}",
      ),
    paired_comment: ($) =>
      seq(
        alias("{%", ""),
        "comment",
        optional($._identifier),
        alias("%}", ""),
        repeat(/.|\s/),
        repeat(seq(alias($.paired_comment, ""), repeat(/.|\s/))),
        alias("{%", ""),
        "endcomment",
        alias("%}", ""),
      ),

    // All other content
    content: ($) => /([^{]|\{[^{%#])+/,
  },
});
