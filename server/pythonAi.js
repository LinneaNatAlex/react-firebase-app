/**
 * Proxy til Python AI-tjeneste: rankApplicants (embeddings) + jobPosting (mal / valgfri LLM i Python).
 * Krever PYTHON_AI_URL på Node; valgfritt PYTHON_AI_SECRET → X-Internal-Secret.
 */

function trimSlash(s) {
  return String(s || '').replace(/\/+$/, '');
}

function pythonErrorMessage(data, fallback) {
  const detail = data?.detail;
  return (
    (typeof detail === 'string' && detail) ||
    (Array.isArray(detail) && detail.map((d) => d?.msg || d).join('; ')) ||
    data?.error ||
    fallback
  );
}

/**
 * @param {{ jobDescription?: string, applicants?: Array<{ id: string, applicantName?: string, coverLetter?: string, profile?: object }> }} payload
 */
export async function rankApplicantsViaPython(payload, baseUrl, secret) {
  const url = `${trimSlash(baseUrl)}/internal/rank`;
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Internal-Secret'] = secret;

  const body = {
    jobDescription: payload?.jobDescription ?? '',
    applicants: Array.isArray(payload?.applicants) ? payload.applicants : [],
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(pythonErrorMessage(data, res.statusText || 'Python rank feilet'));
    err.status = res.status;
    throw err;
  }
  if (!Array.isArray(data.rankings)) {
    const err = new Error('Ugyldig svar fra Python-tjenesten (mangler rankings)');
    err.status = 502;
    throw err;
  }
  return data;
}

/**
 * @param {{ title?: string, company?: string, location?: string, type?: string, salary?: string, keywords?: string, companyAbout?: string, ragContext?: string }} payload
 */
export async function jobPostingViaPython(payload, baseUrl, secret) {
  const url = `${trimSlash(baseUrl)}/internal/job-posting`;
  const headers = { 'Content-Type': 'application/json' };
  if (secret) headers['X-Internal-Secret'] = secret;

  const body = {
    title: payload?.title ?? '',
    company: payload?.company ?? '',
    location: payload?.location ?? '',
    type: payload?.type ?? '',
    salary: payload?.salary ?? '',
    keywords: payload?.keywords ?? '',
    companyAbout: payload?.companyAbout ?? '',
    ragContext: payload?.ragContext ?? '',
  };

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(
      pythonErrorMessage(data, res.statusText || 'Python stillingsannonse feilet'),
    );
    err.status = res.status;
    throw err;
  }
  const text = typeof data.text === 'string' ? data.text.trim() : '';
  if (!text) {
    const err = new Error('Ugyldig svar fra Python-tjenesten (mangler text)');
    err.status = 502;
    throw err;
  }
  return {
    text,
    /** alltid fra lokal Python (/internal/job-posting) */
    aiSource: data.source || 'template',
  };
}
