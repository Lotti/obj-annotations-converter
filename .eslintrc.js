module.exports = {
    parserOptions: {
        ecmaVersion: 2017,
    },
    env: {
        node: true,
        es6: true,
    },
    extends: [`eslint:recommended`],
    rules: {
        // enable additional rules
        "indent": [`error`, 4],
        "linebreak-style": [`error`, `unix`],
        "semi": [`error`, `always`],
        "quotes": [`error`, `backtick`],
        "prefer-template": [`error`],
        "template-curly-spacing": [`error`, `never`],
        "quote-props": [`error`, `consistent-as-needed`],

        // override default options for rules from base configurations
        "comma-dangle": [`error`, `only-multiline`],
        "no-cond-assign": [`error`, `always`],

        // disable rules from base configurations
        "no-console": `warn`,

        "no-unused-vars": `warn`,

        "eol-last": [`error`, `always`],
    }
};

