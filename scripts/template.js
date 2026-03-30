const axios = require("axios");
const fs = require("fs");
const path = require("path");

const input = process.argv[2];
const GRAPHQL_URL = "https://leetcode.com/graphql";

if (!input) {
    console.log("Usage: node scripts/template.js <title-slug|frontend-id|title>");
    process.exit(1);
}

async function graphqlRequest(query, variables) {
    const response = await axios.post(
        GRAPHQL_URL,
        { query, variables },
        {
        headers: {
            "Content-Type": "application/json",
        },
        }
    );

    if (response.data.errors?.length) {
        throw new Error(response.data.errors[0].message);
    }

    return response.data.data;
    }

    function normalize(value) {
    return value.trim().toLowerCase();
    }

    async function resolveProblem(queryText) {
    const directMatch = await graphqlRequest(
        `
        query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
            title
            titleSlug
            questionFrontendId
            }
        }
        `,
        { titleSlug: queryText }
    );

    if (directMatch.question) {
        return directMatch.question;
    }

    const searchResults = await graphqlRequest(
        `
        query searchQuestions($search: String!) {
            problemsetQuestionList(
            categorySlug: ""
            limit: 10
            skip: 0
            filters: { searchKeywords: $search }
            ) {
            questions {
                title
                titleSlug
                questionFrontendId
            }
            }
        }
        `,
        { search: queryText }
    );

    const questions = searchResults.problemsetQuestionList?.questions ?? [];
    const normalizedInput = normalize(queryText);

    return (
        questions.find((question) => {
        return (
            normalize(question.titleSlug) === normalizedInput ||
            normalize(question.title) === normalizedInput ||
            String(question.questionFrontendId) === queryText
        );
        }) ||
        questions[0] ||
        null
    );
    }

    async function fetchProblem() {
    try {
        const resolvedProblem = await resolveProblem(input);

        if (!resolvedProblem?.titleSlug) {
        console.log("Problem not found");
        return;
        }

        const data = await graphqlRequest(
        `
            query getQuestionDetail($titleSlug: String!) {
            question(titleSlug: $titleSlug) {
                title
                titleSlug
                difficulty
                content
                exampleTestcases
            }
            }
        `,
        { titleSlug: resolvedProblem.titleSlug }
        );

        const question = data.question;
        const dir = path.join("problems", question.titleSlug);
        fs.mkdirSync(dir, { recursive: true });

        fs.writeFileSync(
        path.join(dir, "README.md"),
        `# ${question.title}

    ## Difficulty
    ${question.difficulty}

    ## Description
    ${question.content}

    ## Example Testcases
    ${question.exampleTestcases}
    `
        );

        fs.writeFileSync(
        path.join(dir, "solution.js"),
        `// ${question.title}

    function solution() {

    }

    module.exports = solution;
    `
        );

        console.log(`Fetched: ${question.title} (${question.titleSlug})`);
    } catch (err) {
        console.error("Error fetching problem:", err.message);
    }
}

fetchProblem();
