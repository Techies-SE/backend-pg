// services/recommendationPrompt.js

module.exports.createRecommendationPrompt = async function(patientName, labItems) {
  console.log("Lab Items passed to prompt:", labItems);
  const itemsDescription = labItems.map(item => {
    const statusText = item.lab_item_status === "unknown"
      ? "Status is unknown"
      : `Status: ${item.lab_item_status}`;
    return `- ${item.lab_item_name} = ${item.lab_item_value} ${item.unit || ""} (${statusText})`;
  }).join("\n");

  return `
Generate a concise clinical interpretation of the following lab results:

Patient: ${patientName}
Lab Values:
${itemsDescription}

Format your response as:
1) Abnormal findings
2) Clinical implications
3) Recommended follow-up tests or interventions

Use medical terminology. Be direct, specific, and precise. Avoid conversational language.
  `.trim();
}

