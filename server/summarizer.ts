import Anthropic from '@anthropic-ai/sdk';
import type { StoryEvent, SessionDetail, SubAgentDetail } from './types';

const client = new Anthropic(); // ANTHROPIC_API_KEY 환경변수 자동 사용

export async function summarizeSession(
  sessionDetail: SessionDetail,
  subagentDetails: SubAgentDetail[]
): Promise<string> {
  // main events를 요약용 텍스트로 변환
  const mainSummary = buildMainSummaryText(sessionDetail);
  // 각 subagent events도 요약용 텍스트로 변환
  const agentSummaries = subagentDetails.map((a) => buildAgentSummaryText(a));

  const prompt = `다음은 Claude Code 세션의 활동 기록이다. 이 세션에서 일어난 일을 아래 구조로 한국어로 요약해줘:

## 목표
사용자가 원했던 것

## 구현 과정
각 에이전트(main 포함)가 한 일을 순서대로

## 시행착오 및 문제
에러, 재시도, 방향 전환 등

## 결과
최종적으로 달성한 것

---

### Main Session
${mainSummary}

${agentSummaries.map((s, i) => `### Sub-Agent: ${subagentDetails[i]?.agentType} - ${subagentDetails[i]?.description}\n${s}`).join('\n\n')}`;

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2000,
    messages: [{ role: 'user', content: prompt }],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  return textBlock?.text || '요약 생성 실패';
}

function buildMainSummaryText(session: SessionDetail): string {
  const lines: string[] = [];
  for (const event of session.mainEvents) {
    switch (event.type) {
      case 'user_message':
        lines.push(`[User] ${(event.text || '').substring(0, 500)}`);
        break;
      case 'thought':
        lines.push(`[Assistant] ${(event.text || '').substring(0, 300)}`);
        break;
      case 'thinking':
        lines.push(`[Thinking] ${(event.thinkingText || '').substring(0, 200)}`);
        break;
      case 'tool_use':
        lines.push(
          `[Tool] ${event.toolName}: ${JSON.stringify(event.toolInput || {}).substring(0, 200)}`
        );
        break;
      case 'tool_result':
        if (event.isError) {
          lines.push(`[Error] ${(event.content || '').substring(0, 300)}`);
        } else {
          lines.push(`[Result] ${(event.content || '').substring(0, 100)}`);
        }
        break;
      case 'agent_spawn':
        lines.push(
          `[Spawn] ${event.agentType}: ${event.toolInput?.description || ''}`
        );
        break;
      case 'agent_result':
        lines.push(
          `[AgentDone] ${event.agentType}: ${(event.content || '').substring(0, 200)}`
        );
        break;
      case 'system':
        lines.push(`[System] ${event.text}`);
        break;
    }
  }
  // 너무 길면 자름 (토큰 절약)
  const text = lines.join('\n');
  return text.length > 8000
    ? text.substring(0, 8000) + '\n... (truncated)'
    : text;
}

function buildAgentSummaryText(agent: SubAgentDetail): string {
  const lines: string[] = [];
  for (const event of agent.events) {
    switch (event.type) {
      case 'thought':
        lines.push(`[Think] ${(event.text || '').substring(0, 200)}`);
        break;
      case 'thinking':
        lines.push(
          `[Thinking] ${(event.thinkingText || '').substring(0, 150)}`
        );
        break;
      case 'tool_use':
        lines.push(
          `[Tool] ${event.toolName}: ${JSON.stringify(event.toolInput || {}).substring(0, 150)}`
        );
        break;
      case 'tool_result':
        if (event.isError) {
          lines.push(`[Error] ${(event.content || '').substring(0, 200)}`);
        }
        break;
      case 'system':
        lines.push(`[System] ${event.text}`);
        break;
    }
  }
  const text = lines.join('\n');
  return text.length > 3000
    ? text.substring(0, 3000) + '\n... (truncated)'
    : text;
}
