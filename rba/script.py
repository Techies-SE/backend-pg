import sys
import json

# Define a function to classify systolic and diastolic blood pressure
def classify_bp(systolic, diastolic):
    def get_classification(value, is_systolic=True):
        if value < 140 if is_systolic else value < 90:
            return "normal", None
        elif (140 <= value < 160) if is_systolic else (90 <= value < 110):
            return "high", "Avoid caffeinated drinks and consult a doctor."
        elif (160 <= value < 180) if is_systolic else (110 <= value < 120):
            return "very high", "Consult a doctor."
        else:
            return "dangerously high", "Seek immediate medical attention."

    systolic_class, systolic_rec = get_classification(systolic, True)
    diastolic_class, diastolic_rec = get_classification(diastolic, False)

    return {
        "systolic": {"classification": systolic_class, "recommendation": systolic_rec},
        "diastolic": {"classification": diastolic_class, "recommendation": diastolic_rec}
    }

# Define a function to classify lipid profile
def classify_lipid_profile(cholesterol, triglyceride, hdl, ldl):
    results = {}
    if cholesterol < 200:
        results['cholesterol'] = {"classification": "normal", "recommendation": None}
    else:
        results['cholesterol'] = {"classification": "high", "recommendation": "Reduce intake of fats and cholesterol."}
    
    if triglyceride < 150:
        results['triglyceride'] = {"classification": "normal", "recommendation": None}
    else:
        results['triglyceride'] = {"classification": "high", "recommendation": "Reduce intake of sugars and fats."}
    
    results['hdl'] = {"classification": "low", "recommendation": "Increase physical activity."} if hdl < 40 else {"classification": "normal", "recommendation": None}
    
    if ldl <= 100:
        results['ldl'] = {"classification": "normal", "recommendation": None}
    elif ldl > 190:
        results['ldl'] = {"classification": "very high", "recommendation": "Medication may be needed."}
    else:
        results['ldl'] = {"classification": "high", "recommendation": "Reduce saturated fats."}

    return results

# Define a function to evaluate kidney health
def classify_kidney_health(eGFR, creatinine, gender):
    results = {}
    # Classify eGFR
    if eGFR < 15:
        results['eGFR'] = {"classification": "Stage 5", "recommendation": "Seek medical advice."}
    elif 15 <= eGFR < 30:
        results['eGFR'] = {"classification": "Stage 4", "recommendation": "Seek medical advice."}
    elif 30 <= eGFR < 60:
        results['eGFR'] = {"classification": "Stage 3", "recommendation": "Seek medical advice."}
    elif 60 <= eGFR <= 90:
        results['eGFR'] = {"classification": "Stage 2", "recommendation": "Monitor kidney function."}
    else:  # eGFR > 90
        results['eGFR'] = {"classification": "Stage 1", "recommendation": "Monitor kidney function."}

    # Classify Creatinine
    if gender == 'M':
        if creatinine <= 1.17:
            results['creatinine'] = {"classification": "normal", "recommendation": None}
        else:
            results['creatinine'] = {"classification": "high", "recommendation": "Seek medical advice."}
    elif gender == 'F':
        if creatinine <= 0.95:
            results['creatinine'] = {"classification": "normal", "recommendation": None}
        else:
            results['creatinine'] = {"classification": "high", "recommendation": "Seek medical advice."}

    return results

# Define a function to evaluate liver function
def evaluate_liver_function(total_protein, globulin, albumin, ast, alt, alp, total_bilirubin, direct_bilirubin, gender):
    results = {}

    # Protein Levels
    if 2.4 <= globulin <= 3.9:
        results['globulin'] = {"classification": "normal", "recommendation": None}
    else:
        results['globulin'] = {"classification": "abnormal", "recommendation": "Consult a doctor."}

    if albumin < 3.3:
        results['albumin'] = {"classification": "low", "recommendation": "Seek medical advice."}
    elif 3.3 <= albumin <= 5.2:
        results['albumin'] = {"classification": "normal", "recommendation": None}

    # Enzyme Levels
    if gender == 'M':
        results['AST'] = {"classification": "high", "recommendation": "Consult a doctor."} if ast > 40 else {"classification": "normal", "recommendation": None}
        results['ALT'] = {"classification": "high", "recommendation": "Consult a doctor."} if alt > 41 else {"classification": "normal", "recommendation": None}
    else:
        results['AST'] = {"classification": "high", "recommendation": "Consult a doctor."} if ast > 32 else {"classification": "normal", "recommendation": None}
        results['ALT'] = {"classification": "high", "recommendation": "Consult a doctor."} if alt > 33 else {"classification": "normal", "recommendation": None}

    # Bilirubin Levels
    if total_bilirubin > 0 or direct_bilirubin > 0:
        results['bilirubin'] = {"classification": "high", "recommendation": None}
    else:
        results['bilirubin'] = {"classification": "normal", "recommendation": None}

    return results

# Define a function to evaluate uric acid levels
def evaluate_uric_acid(uric_acid, gender):
    results = {}
    if gender == 'M':
        if uric_acid > 7:
            results['uric_acid'] = {"classification": "high", "recommendation": "Consult a doctor"}
            # result['classification'] = "high"
            # result['recommendation'] = "Consult a doctor."
        else:
            results['uric_acid'] = {"classification": "normal", "recommendation": None}
            # result['classification'] = "normal"
            # result['recommendation'] = None
    elif gender == 'F':
        if uric_acid > 6:
            results['uric_acid'] = {"classification": "high", "recommendation": "Consult a doctor"}
            # result['classification'] = "high"
            # result['recommendation'] = "Consult a doctor."
        else:
            results['uric_acid'] = {"classification": "normal", "recommendation": None}
            # result['classification'] = "normal"
            # result['recommendation'] = None

    return results

# Define a function to evaluate complete blood count (CBC)
def evaluate_cbc(hct, mcv, wbc, neutrophile, eosinophile, monocyte, plt_count, gender):
    results = {}

    # Evaluate HCT
    if gender == 'M':
        if 42 <= hct <= 54:
            results['HCT'] = {"classification": "ปกติ", "recommendation": None}
        elif 33 <= hct < 42:
            results['HCT'] = {"classification": "เม็ดเลือดจางเล็กน้อย", "recommendation": "แนะนำตรวจเพิ่มเติม"}
        elif 27 <= hct < 33:
            results['HCT'] = {"classification": "เม็ดเลือดจางปานกลาง", "recommendation": "ควรปรึกษาแพทย์"}
        elif hct < 27:
            results['HCT'] = {"classification": "เม็ดเลือดจางรุนแรง", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}
    elif gender == 'F':
        if 36 <= hct <= 48:
            results['HCT'] = {"classification": "ปกติ", "recommendation": None}
        elif 33 <= hct < 36:
            results['HCT'] = {"classification": "เม็ดเลือดจางเล็กน้อย", "recommendation": "แนะนำตรวจเพิ่มเติม"}
        elif 27 <= hct < 33:
            results['HCT'] = {"classification": "เม็ดเลือดจางปานกลาง", "recommendation": "ควรปรึกษาแพทย์"}
        elif hct < 27:
            results['HCT'] = {"classification": "เม็ดเลือดจางรุนแรง", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}

    # Evaluate MCV
    if mcv < 80:
        results['MCV'] = {"classification": "เม็ดเลือดแดงมีขนาดเล็ก", "recommendation": "อาจเกิดจากขาดธาตุเหล็ก หรือเป็นพาหะธาลัสซีเมีย"}
    elif 80 <= mcv <= 100:
        results['MCV'] = {"classification": "ปกติ", "recommendation": None}
    elif mcv > 100:
        results['MCV'] = {"classification": "เม็ดเลือดแดงมีขนาดใหญ่", "recommendation": "อาจเกิดจากขาดโฟเลต หรือวิตามินบี 12 หรือโรคเลือดบางชนิด"}

    # Evaluate WBC
    if 6000 <= wbc <= 10000:
        results['WBC'] = {"classification": "ปกติ", "recommendation": None}
    elif wbc < 6_000:
        neutro_count = wbc * neutrophile / 100
        if neutro_count < 1000:
            results['WBC'] = {"classification": "เม็ดเลือดขาวต่ำอันตราย", "recommendation": "ควรปรึกษาแพทย์ ระวังการติดเชื้อ หลีกเลี่ยงอาหารดิบ"}
        else:
            results['WBC'] = {"classification": "เม็ดเลือดขาวต่ำ", "recommendation": None}
    elif 10_000 < wbc <= 20_000:
        results['WBC'] = {"classification": "เม็ดเลือดขาวสูง", "recommendation": "อาจเกิดจากการติดเชื้อ หากมีไข้สูงหรือไข้เรื้อรัง ควรปรึกษาแพทย์"}
    elif wbc > 20_000:
        results['WBC'] = {"classification": "เม็ดเลือดขาวสูงมาก", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}

    # Evaluate EOSINOPHILE
    eos_count = wbc * eosinophile / 100
    if eos_count > 500:
        results['Eosinophile'] = {"classification": "เม็ดเลือดขาว EOSINOPHILE สูง", "recommendation": "อาจเกิดจากภูมิแพ้ หอบหืด หรือพยาธิ"}

    # Evaluate MONOCYTE
    if 2 <= monocyte <= 6:
        results['Monocyte'] = {"classification": "ปกติ", "recommendation": None}
    elif monocyte > 6:
        results['Monocyte'] = {"classification": "MONOCYTE สูง", "recommendation": "มักพบหลังติดเชื้อเกิน 2 สัปดาห์ หรือหลังฉีดวัคซีน"}

    # Evaluate Platelets
    if plt_count < 100000:
        results['PLT Count'] = {"classification": "เกล็ดเลือดต่ำ", "recommendation": "ควรระวังอาการเลือดออกผิดปกติ และควรพบแพทย์"}
    elif 100000 <= plt_count <= 450000:
        results['PLT Count'] = {"classification": "ปกติ", "recommendation": None}
    elif 450000 < plt_count <= 600000:
        results['PLT Count'] = {"classification": "เกล็ดเลือดสูง", "recommendation": "อาจพบในพาหะธาลัสซีเมีย หรือมีอาการไข้เรื้อรัง ควรปรึกษาแพทย์"}
    elif plt_count > 600000:
        results['PLT Count'] = {"classification": "เกล็ดเลือดสูงมาก", "recommendation": "ควรปรึกษาแพทย์เพื่อหาสาเหตุ"}

    return results

# Define a main function to evaluate lab results based on lab_test_id
def evaluate_lab_results(lab_test_master_id, lab_item_values):
    if lab_test_master_id == 1:  # Blood Pressure
        return classify_bp(lab_item_values['Systolic'], lab_item_values['Diastolic'])
    elif lab_test_master_id == 2:  # Lipid Profile
        return classify_lipid_profile(
            lab_item_values['Cholesterol'],
            lab_item_values['Triglyceride'],
            lab_item_values['HDL'],
            lab_item_values['LDL']
        )
    elif lab_test_master_id == 3:  # Kidney Health
        return classify_kidney_health(
            lab_item_values['eGFR'],
            lab_item_values['Creatinine'],
            lab_item_values['Gender']
        )
    elif lab_test_master_id == 4:  # Liver Function
        return evaluate_liver_function(
            lab_item_values['Total Protein'],
            lab_item_values['Globulin'],
            lab_item_values['Albumin'],
            lab_item_values['AST'],
            lab_item_values['ALT'],
            lab_item_values['ALP'],
            lab_item_values['Total Bilirubin'],
            lab_item_values['Direct Bilirubin'],
            lab_item_values['Gender']
        )
    elif lab_test_master_id == 5:  # Uric Acid
        return evaluate_uric_acid(lab_item_values['Uric Acid'], lab_item_values['Gender'])
    elif lab_test_master_id == 6:  # Complete Blood Count (CBC)
        return evaluate_cbc(
            lab_item_values['HCT'],
            lab_item_values['MCV'],
            lab_item_values['WBC'],
            lab_item_values['Neutrophile'],
            lab_item_values['Eosinophile'],
            lab_item_values['Monocyte'],
            lab_item_values['PLT Count'],
            lab_item_values['Gender']
        )
    else:
        return {"error": "Unknown lab test"}

if __name__ == "__main__":
    lab_test_master_id = sys.argv[1]  # Lab test ID (passed from Node.js)
    lab_item_values = json.loads(sys.argv[2])  # Parse JSON input

    result = evaluate_lab_results(int(lab_test_master_id), lab_item_values)
    print(json.dumps(result))