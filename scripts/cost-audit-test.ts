/**
 * Cost Audit Test Script
 * 
 * Runs Short, Medium, and Long ICE builds to capture actual token usage.
 * Set COST_AUDIT_LOGGING=true in environment before running.
 * 
 * Usage: npx tsx scripts/cost-audit-test.ts [short|medium|long|all]
 */

import { runPipeline } from "../server/pipeline/runner";
import { storage } from "../server/storage";

const SHORT_TEST_CONTENT = `
# Product Launch Guide

Welcome to our new product launch training. This guide covers the key steps.

## Key Features
- Easy to use interface
- Cloud-based solution
- 24/7 support available

## Getting Started
1. Log into the dashboard
2. Create your first project
3. Invite team members

## Best Practices
Always test before going live. Document your process. Ask for help when needed.
`.trim();

const MEDIUM_TEST_CONTENT = `
# Leadership Development Programme

Welcome to the leadership development programme. This comprehensive guide will help you develop essential leadership skills over the next 6 weeks.

## Module 1: Self-Awareness

Understanding yourself is the foundation of effective leadership. Leaders who know their strengths and weaknesses can better leverage their abilities and develop areas for growth.

### Key Concepts
- Emotional intelligence and its role in leadership
- Identifying your leadership style
- Understanding your impact on others
- Receiving and acting on feedback

### Reflection Questions
1. What situations bring out your best leadership qualities?
2. When do you find leadership most challenging?
3. How do others describe your leadership approach?

## Module 2: Building Trust

Trust is the cornerstone of all effective relationships. As a leader, your ability to build and maintain trust directly impacts team performance and engagement.

### The Trust Equation
Trust = (Credibility + Reliability + Intimacy) / Self-Orientation

### Practical Applications
- Keep commitments, even small ones
- Admit mistakes openly
- Share information transparently
- Put team needs before personal agenda

## Module 3: Effective Communication

Great leaders are great communicators. This module focuses on both speaking and listening skills.

### Active Listening
- Give full attention
- Ask clarifying questions
- Summarize to confirm understanding
- Avoid interrupting

### Clear Messaging
- Know your audience
- Be concise and direct
- Use stories and examples
- Check for understanding

## Module 4: Decision Making

Leaders make decisions every day. This module explores how to make better decisions, faster.

### Decision Framework
1. Define the problem clearly
2. Gather relevant information
3. Consider alternatives
4. Evaluate risks and benefits
5. Make the decision
6. Review and learn

## Module 5: Developing Others

A leader's job is to develop other leaders. This module covers coaching and mentoring skills.

### Coaching Conversations
- Ask more than tell
- Focus on growth, not fixing
- Celebrate progress
- Provide constructive challenge

## Module 6: Leading Change

Change is constant. This module helps you lead teams through uncertainty.

### Change Curve
Understanding the emotional journey of change helps you support your team effectively.

### Key Principles
- Communicate early and often
- Involve people in the process
- Acknowledge what's being lost
- Celebrate early wins
`.trim();

const LONG_TEST_CONTENT = `
# Strategic Thinking Workshop

Welcome to the Strategic Thinking Workshop. This intensive programme is designed for senior leaders who need to navigate complexity and drive organizational transformation.

## Part 1: Understanding Strategy

Strategy is about making choices. Good strategy requires understanding where you are, where you want to go, and how you'll get there.

### What Strategy Is Not
- Strategy is not a to-do list
- Strategy is not a budget
- Strategy is not aspirational goals without a path
- Strategy is not copying competitors

### What Strategy Is
Strategy is a coherent set of choices that position you to win in your chosen domain.

### The Strategy Kernel
Every good strategy has three elements:
1. Diagnosis - understanding the challenge
2. Guiding Policy - the overall approach
3. Coherent Actions - coordinated steps forward

## Part 2: Environmental Analysis

Before making strategic choices, you must understand your environment. This means looking both inside and outside the organization.

### External Analysis: PESTLE
- Political factors
- Economic conditions
- Social trends
- Technological changes
- Legal requirements
- Environmental considerations

### Internal Analysis: Capabilities
- What are we exceptionally good at?
- What resources do we have?
- What can we do that others cannot?
- Where are our gaps?

### Competitive Analysis
- Who are our real competitors?
- What are their strategies?
- Where are they vulnerable?
- How might they respond to our moves?

## Part 3: Strategic Choices

Strategy is fundamentally about making choices. You cannot be all things to all people.

### Where to Play
- Which markets or segments?
- Which customer needs?
- Which geographies?
- Which channels?

### How to Win
- Cost leadership
- Differentiation
- Focus
- Innovation
- Customer intimacy

### Must-Win Battles
Identify the 3-5 most critical initiatives that will determine success.

## Part 4: Scenario Planning

The future is uncertain. Scenario planning helps you prepare for multiple possibilities.

### Building Scenarios
1. Identify key uncertainties
2. Create 2-4 distinct futures
3. Develop implications for each
4. Identify robust strategies
5. Create early warning indicators

### Using Scenarios
- Test current strategy against each scenario
- Identify no-regret moves
- Build contingency plans
- Monitor for signs of which scenario is emerging

## Part 5: Strategy Execution

A brilliant strategy poorly executed is worthless. Execution is where strategy meets reality.

### Alignment
- Does everyone understand the strategy?
- Are goals aligned across the organization?
- Do incentives support strategic priorities?
- Are resources allocated to strategic initiatives?

### Culture and Strategy
Culture can enable or destroy strategy. Assess whether your culture supports your strategic choices.

### Governance
- Regular strategy reviews
- Clear accountability
- Transparent progress tracking
- Willingness to adapt

## Part 6: Strategic Leadership

Leaders play a unique role in making strategy work.

### The Leader's Role
- Set direction and inspire others
- Make the tough calls
- Remove barriers
- Model desired behaviors
- Stay the course (while remaining adaptable)

### Common Pitfalls
- Chasing too many priorities
- Underestimating resistance
- Over-engineering the plan
- Neglecting culture
- Failing to communicate

## Part 7: Challenge Workshop

Apply what you've learned to a real strategic challenge facing your organization.

### Workshop Process
1. Present your challenge
2. Receive structured feedback
3. Generate new options
4. Stress-test your thinking
5. Commit to next steps

### Peer Coaching
Work with fellow participants to challenge and refine your strategic thinking.

## Part 8: Personal Strategic Plan

Every leader needs a personal strategy for their own development and impact.

### Reflection Questions
- What's your unique contribution?
- Where do you want to be in 3-5 years?
- What must you develop to get there?
- Who can help you?

### Action Planning
Leave with a concrete 90-day plan for applying strategic thinking in your role.

## Conclusion

Strategic thinking is a skill that develops with practice. Return to these concepts regularly, apply them in your work, and continue refining your approach.

Remember: the goal is not to predict the future perfectly, but to position yourself to succeed across multiple possible futures.

Thank you for participating. Good luck on your strategic journey.
`.trim();

async function createTestJob(sourceText: string, storyLength: "short" | "medium" | "long"): Promise<number> {
  const testUserId = 1;
  
  const job = await storage.createTransformationJob({
    userId: testUserId,
    sourceFileName: `cost-audit-test-${storyLength}.txt`,
    sourceFilePath: null,
    storyLength,
    hookPackCount: 3,
    releaseMode: "instant",
    startDate: null,
    contentSourceType: "documentation",
    contentIndustry: "education",
    contentCategory: "educational",
    contentGoal: "education",
    sourceUrl: null,
  });
  
  return job.id;
}

async function runTest(storyLength: "short" | "medium" | "long") {
  const content = storyLength === "short" ? SHORT_TEST_CONTENT 
                : storyLength === "medium" ? MEDIUM_TEST_CONTENT 
                : LONG_TEST_CONTENT;
  
  console.log(`\n${"=".repeat(60)}`);
  console.log(`[COST_AUDIT_TEST] Starting ${storyLength.toUpperCase()} ICE test`);
  console.log(`[COST_AUDIT_TEST] Content length: ${content.length} characters`);
  console.log(`${"=".repeat(60)}\n`);
  
  const startTime = Date.now();
  
  try {
    const jobId = await createTestJob(content, storyLength);
    console.log(`[COST_AUDIT_TEST] Created job ${jobId}`);
    
    const universeId = await runPipeline(jobId, content);
    
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.log(`\n${"=".repeat(60)}`);
    console.log(`[COST_AUDIT_TEST] ${storyLength.toUpperCase()} test COMPLETED`);
    console.log(`[COST_AUDIT_TEST] Universe ID: ${universeId}`);
    console.log(`[COST_AUDIT_TEST] Duration: ${duration}s`);
    console.log(`${"=".repeat(60)}\n`);
    
    return { success: true, universeId, duration };
  } catch (error) {
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(1);
    
    console.error(`\n${"=".repeat(60)}`);
    console.error(`[COST_AUDIT_TEST] ${storyLength.toUpperCase()} test FAILED after ${duration}s`);
    console.error(`[COST_AUDIT_TEST] Error:`, error);
    console.error(`${"=".repeat(60)}\n`);
    
    return { success: false, error, duration };
  }
}

async function main() {
  const args = process.argv.slice(2);
  const testType = args[0] || "all";
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# COST AUDIT TEST RUNNER`);
  console.log(`# COST_AUDIT_LOGGING: ${process.env.COST_AUDIT_LOGGING || "false"}`);
  console.log(`# Test type: ${testType}`);
  console.log(`${"#".repeat(60)}\n`);
  
  if (process.env.COST_AUDIT_LOGGING !== "true") {
    console.warn("WARNING: COST_AUDIT_LOGGING is not set to 'true'");
    console.warn("Token counts will not be logged.\n");
  }
  
  const results: Record<string, any> = {};
  
  if (testType === "short" || testType === "all") {
    results.short = await runTest("short");
  }
  
  if (testType === "medium" || testType === "all") {
    results.medium = await runTest("medium");
  }
  
  if (testType === "long" || testType === "all") {
    results.long = await runTest("long");
  }
  
  console.log(`\n${"#".repeat(60)}`);
  console.log(`# TEST SUMMARY`);
  console.log(`${"#".repeat(60)}`);
  for (const [type, result] of Object.entries(results)) {
    console.log(`# ${type.toUpperCase()}: ${result.success ? "PASS" : "FAIL"} (${result.duration}s)`);
  }
  console.log(`${"#".repeat(60)}\n`);
  
  console.log("Review the logs above for [COST_AUDIT] entries showing token counts.");
}

main().catch(console.error);
