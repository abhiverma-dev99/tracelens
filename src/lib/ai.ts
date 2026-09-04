import { GoogleGenerativeAI } from "@google/generative-ai";
import Groq from "groq-sdk";

// 1. Clients Initialization
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY as string);
const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// 2. The Smart Parser & Validator
const parseAIResponse = (text: string) => {
  try {
    const firstBrace = text.indexOf("{");
    const lastBrace = text.lastIndexOf("}");

    if (firstBrace === -1 || lastBrace === -1) {
      throw new Error("No JSON object found in AI response");
    }

    const jsonString = text.substring(firstBrace, lastBrace + 1);
    const parsedData = JSON.parse(jsonString);

    if (!parsedData.rootCause || !parsedData.solution) {
      throw new Error("Missing required keys");
    }

    return {
      rootCause: String(parsedData.rootCause),
      solution: String(parsedData.solution),
    };
  } catch (e) {
    console.error("[Parser Error]:", e);
    throw new Error("AI Parsing Failed");
  }
};

// 3. The Main Multi-Vendor AI Function
export const analyzeIncidentWithAI = async (
  message: string,
  stackTrace: string,
  recentCommits: any[],
) => {
  const commitsText =
    recentCommits.length > 0
      ? recentCommits
          .map((c) => `- Commit [${c.commitHash}] by ${c.author}: ${c.message}`)
          .join("\n")
      : "No recent commits found.";

  const prompt = `
You are a senior software engineer debugging a critical production crash.
Error Message: ${message}
Stack Trace: ${stackTrace}

CONTEXT - Recent Code Commits (Deployments) made right before this error:
${commitsText}

Task: 
1. Analyze the stack trace.
2. Cross-reference it with the "Recent Code Commits" to see if a recent change caused this.
3. Return ONLY a valid JSON object with exactly two keys: "rootCause" (explain the technical issue and if a commit caused it) and "solution" (how to fix it).
Do not include markdown tags like \`\`\`json.
`;

  try {
    const model = genAI.getGenerativeModel({
      model: process.env.GEMINI_MODEL || "gemini-3.5-flash",
    });
    const result = await model.generateContent(prompt);
    return parseAIResponse(result.response.text());
  } catch (geminiError) {
    console.warn(
      "[AI Warning]: Gemini failed. Switching to Groq...",
      geminiError,
    );

    try {
      const chatCompletion = await groq.chat.completions.create({
        messages: [{ role: "user", content: prompt }],
        model: process.env.GROQ_MODEL || "groq/compound-mini",
      });

      const groqText = chatCompletion.choices[0]?.message?.content || "";
      return parseAIResponse(groqText);
    } catch (groqError) {
      console.error("[AI Error]: Both Gemini and Groq failed!", groqError);
      throw new Error("AI Analysis completely failed.");
    }
  }
};
