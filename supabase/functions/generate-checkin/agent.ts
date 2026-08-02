// Generic Gemini function-calling loop. Deno runtime.
const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

// deno-lint-ignore no-explicit-any
type Json = any;
interface FunctionDeclaration { name: string; description: string; parameters: Json }
export interface ToolDef {
  declaration: FunctionDeclaration;
  run: (args: Record<string, unknown>) => Promise<unknown>;
}
interface Part { text?: string; functionCall?: { name: string; args?: Record<string, unknown> }; functionResponse?: Json }
interface Content { role: 'user' | 'model'; parts: Part[] }

function stripJsonFence(text: string): string {
  let t = text.trim();
  if (t.startsWith('```')) t = t.replace(/^```(?:json)?\s*/i, '').replace(/\s*```\s*$/i, '');
  return t.trim();
}

async function callGemini(apiKey: string, system: string, contents: Content[], declarations: FunctionDeclaration[]) {
  const res = await fetch(`${GEMINI_URL}?key=${encodeURIComponent(apiKey)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: system }] },
      contents,
      tools: [{ functionDeclarations: declarations }],
      toolConfig: { functionCallingConfig: { mode: 'AUTO' } },
      generationConfig: { temperature: 0.4 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini request failed (${res.status}): ${await res.text()}`);
  return (await res.json()) as { candidates?: { content?: { parts?: Part[] } }[] };
}

export async function runAgent(opts: {
  apiKey: string;
  system: string;
  userMessage: string;
  tools: ToolDef[];
  maxIterations?: number;
}): Promise<string> {
  const maxIterations = opts.maxIterations ?? 6;
  const declarations = opts.tools.map((t) => t.declaration);
  const byName = new Map(opts.tools.map((t) => [t.declaration.name, t]));
  const contents: Content[] = [{ role: 'user', parts: [{ text: opts.userMessage }] }];

  for (let i = 0; i < maxIterations; i++) {
    const res = await callGemini(opts.apiKey, opts.system, contents, declarations);
    const parts = res.candidates?.[0]?.content?.parts ?? [];
    const calls = parts.filter((p) => p.functionCall).map((p) => p.functionCall!);

    if (calls.length === 0) {
      const text = parts.map((p) => p.text ?? '').join('').trim();
      if (!text) throw new Error('Empty agent response');
      return stripJsonFence(text);
    }

    contents.push({ role: 'model', parts });
    const responseParts: Part[] = [];
    for (const call of calls) {
      const tool = byName.get(call.name);
      let result: unknown;
      try {
        result = tool ? await tool.run(call.args ?? {}) : { error: `unknown tool ${call.name}` };
      } catch (e) {
        result = { error: e instanceof Error ? e.message : String(e) };
      }
      responseParts.push({ functionResponse: { name: call.name, response: { result } } });
    }
    contents.push({ role: 'user', parts: responseParts });
  }
  throw new Error('Agent exceeded max iterations without a final answer');
}
