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
3. Return ONLY a valid JSON object with exactly two keys: 
   - "rootCause": Explain the precise technical issue and which commit likely caused it.
   - "solution": DO NOT give theoretical explanations. Provide the exact actionable code snippet to fix the issue. Use this exact format:
     
     Before:
     [code with bug]
     
     After:
     [fixed code]

Do not include markdown tags wrapping the entire JSON output like \`\`\`json.
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
        model: process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      });

      const groqText = chatCompletion.choices[0]?.message?.content || "";
      return parseAIResponse(groqText);
    } catch (groqError) {
      console.error("[AI Error]: Both Gemini and Groq failed!", groqError);
      throw new Error("AI Analysis completely failed.");
    }
  }
};

const buildStreamPrompt = (
  message: string,
  stackTrace: string,
  recentCommits: { commitHash: string; author: string; message: string }[],
) => {
  const commitsText =
    recentCommits.length > 0
      ? recentCommits
          .map((c) => `- Commit [${c.commitHash}] by ${c.author}: ${c.message}`)
          .join("\n")
      : "No recent commits found.";

  return `You are a senior software engineer debugging a critical production crash.
Error Message: ${message}
Stack Trace: ${stackTrace}

CONTEXT - Recent Code Commits (Deployments) made right before this error:
${commitsText}

Write the response using exactly these markers and no other headings:

ROOT_CAUSE:
Explain the precise technical issue and which commit likely caused it.

SUGGESTED_FIX:
Provide the exact actionable code snippet to fix the issue using:

Before:
[code with bug]

After:
[fixed code]
`;
};

type StreamSection = "rootCause" | "solution";

export const splitStreamingAnalysis = () => {
  let mode: "preamble" | StreamSection = "preamble";
  let pending = "";
  let rootCause = "";
  let solution = "";

  const consume = (chunk: string, onChunk: (section: StreamSection, text: string) => void) => {
    pending += chunk;

    while (pending.length) {
      if (mode === "preamble") {
        const idx = pending.toUpperCase().indexOf("ROOT_CAUSE:");
        if (idx === -1) {
          pending = pending.slice(-20);
          return { rootCause, solution };
        }
        pending = pending.slice(idx + "ROOT_CAUSE:".length);
        mode = "rootCause";
        continue;
      }

      if (mode === "rootCause") {
        const idx = pending.toUpperCase().indexOf("SUGGESTED_FIX:");
        if (idx === -1) {
          if (pending.length > 24) {
            const emit = pending.slice(0, -24);
            pending = pending.slice(-24);
            if (emit) {
              rootCause += emit;
              onChunk("rootCause", emit);
            }
          }
          return { rootCause, solution };
        }
        const emit = pending.slice(0, idx);
        pending = pending.slice(idx + "SUGGESTED_FIX:".length);
        if (emit) {
          rootCause += emit;
          onChunk("rootCause", emit);
        }
        mode = "solution";
        continue;
      }

      if (pending) {
        solution += pending;
        onChunk("solution", pending);
        pending = "";
      }
      return { rootCause, solution };
    }

    return { rootCause, solution };
  };

  const flush = (onChunk: (section: StreamSection, text: string) => void) => {
    if (mode === "rootCause" && pending.trim()) {
      rootCause += pending;
      onChunk("rootCause", pending);
    } else if (mode === "solution" && pending) {
      solution += pending;
      onChunk("solution", pending);
    }
    pending = "";
    return { rootCause: rootCause.trim(), solution: solution.trim() };
  };

  return { consume, flush };
};

export const analyzeIncidentWithAIStream = async (
  message: string,
  stackTrace: string,
  recentCommits: { commitHash: string; author: string; message: string }[],
  onChunk: (section: StreamSection, text: string) => void,
  signal?: AbortSignal,
) => {
  const prompt = buildStreamPrompt(message, stackTrace, recentCommits);
  const splitter = splitStreamingAnalysis();

  const consumeText = (text: string) => {
    if (signal?.aborted) return;
    if (text) splitter.consume(text, onChunk);
  };

  const geminiModels = [
    ...new Set([
      process.env.GEMINI_MODEL || "gemini-3.5-flash",
      "gemini-3.6-flash",
      "gemini-2.0-flash",
    ]),
  ];
  const groqModels = [
    ...new Set([
      process.env.GROQ_MODEL || "llama-3.1-8b-instant",
      "llama-3.1-8b-instant",
    ]),
  ];

  let streamed = false;
  for (const modelName of geminiModels) {
    if (signal?.aborted) break;
    try {
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContentStream(prompt);
      for await (const chunk of result.stream) {
        if (signal?.aborted) break;
        consumeText(chunk.text());
      }
      streamed = true;
      break;
    } catch (geminiError) {
      console.warn(`[AI Warning]: Gemini model ${modelName} failed.`, geminiError);
    }
  }

  if (!streamed && !signal?.aborted) {
    for (const modelName of groqModels) {
      if (signal?.aborted) break;
      try {
        const stream = await groq.chat.completions.create({
          messages: [{ role: "user", content: prompt }],
          model: modelName,
          stream: true,
        });

        for await (const chunk of stream) {
          if (signal?.aborted) break;
          consumeText(chunk.choices[0]?.delta?.content || "");
        }
        streamed = true;
        break;
      } catch (groqError) {
        console.warn(`[AI Warning]: Groq model ${modelName} failed.`, groqError);
      }
    }
  }

  if (!streamed && !signal?.aborted) {
    const fallback = await analyzeIncidentWithAI(message, stackTrace, recentCommits);
    if (fallback.rootCause) onChunk("rootCause", fallback.rootCause);
    if (fallback.solution) onChunk("solution", fallback.solution);
    return fallback;
  }

  return splitter.flush(onChunk);
};

