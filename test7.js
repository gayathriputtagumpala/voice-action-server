const axios = require('axios');
require('dotenv').config({ path: './.env' });

async function test() {
  try {
    const context = { DisplayName: 'John', Department: 'IT', TenureMonths: 12, TenureCategory: 'Junior', RecentAbsences: 0, TotalAbsenceDays: 0, AbsenceRisk: 'Low', Location: 'NY' };
    const healthProblem = 'heart condition';
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    const prompt = `You are an HR Wellness Agent. Based on this employee context, generate exactly 6 personalized wellness questions.

EMPLOYEE CONTEXT:
- Name: ${context.DisplayName}
- Department: ${context.Department}
- Tenure: ${context.TenureMonths} months (${context.TenureCategory})
- Recent Absences (last 3 months): ${context.RecentAbsences}
- Total Absence Days: ${context.TotalAbsenceDays}
- Absence Risk: ${context.AbsenceRisk}
- Location: ${context.Location}
- Reported Health Problem: ${healthProblem || 'None reported'}

RULES:
1. Questions must be personalized based on context and the specific Reported Health Problem (if any). If a health problem is reported, tailor at least 3 questions directly to assessing its impact and their well-being.
2. If TenureMonths < 3: include onboarding/adaptation question
3. If RecentAbsences > 2: include health/wellbeing question  
4. If TotalAbsenceDays > 10: include stress/burnout question
5. Always include sleep, stress, work-life balance questions
6. Questions should be empathetic and non-intrusive
7. Each question must have 4 answer options

Return ONLY valid JSON in this exact format:
{
  "questions": [
    {
      "id": 1,
      "question": "question text",
      "category": "sleep|stress|worklife|health|social|adaptation",
      "options": [
        {"value": 1, "label": "option 1"},
        {"value": 2, "label": "option 2"},
        {"value": 3, "label": "option 3"},
        {"value": 4, "label": "option 4"}
      ]
    }
  ]
}`;

    const geminiRes = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      { contents: [{ parts: [{ text: prompt }] }], generationConfig: { temperature: 0.7, maxOutputTokens: 2000, responseMimeType: 'application/json' } },
      { headers: { 'Content-Type': 'application/json' } }
    );
    console.log('Finish Reason:', geminiRes.data.candidates[0].finishReason);
    const responseText = geminiRes.data.candidates[0].content?.parts[0].text;
    console.log('Has Text:', !!responseText);
    console.log(responseText);
  } catch (e) {
    console.error('Error:', e.message);
  }
}
test();
