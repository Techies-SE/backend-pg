// services/recommendationPrompt.js

module.exports.createRecommendationPrompt = async function (
  patientName,
  labItems
) {
  console.log("Lab Items passed to prompt:", labItems);

  // Group lab items by test type for better organization
  const groupedByTest = {};
  labItems.forEach((item) => {
    const testName = item.lab_test_name || "General Lab";
    if (!groupedByTest[testName]) {
      groupedByTest[testName] = [];
    }
    groupedByTest[testName].push(item);
  });

  // Create organized description
  let itemsDescription = "";
  Object.keys(groupedByTest).forEach((testName) => {
    itemsDescription += `\n${testName}:\n`;
    groupedByTest[testName].forEach((item) => {
      const statusText =
        item.lab_item_status === "unknown" || item.lab_item_status === null
          ? "Status is unknown"
          : `Status: ${item.lab_item_status}`;
      itemsDescription += `  - ${item.lab_item_name} = ${item.lab_item_value} ${
        item.unit || ""
      } (${statusText})\n`;
    });
  });

  return `
Generate an overall short and simple clinical interpretation of the following lab results from today's testing not more than 50 words:

Patient: ${patientName}
Lab Values:
${itemsDescription}

Format your response as:
1) Summary of all tests performed
2) Abnormal findings across all tests
5) Overall assessment and priority level

Use medical terminology. Be direct, specific, and precise. Consider the complete clinical picture from all tests performed on this date.Rememeber to be short enough for a doctor to quick review.
  `.trim();
};
