# import sys
# import json

# # Define a function to classify systolic and diastolic blood pressure
# def classify_bp(systolic, diastolic):
#     def get_classification(value, is_systolic=True):
#         if value < 140 if is_systolic else value < 90:
#             return "normal", None
#         elif (140 <= value < 160) if is_systolic else (90 <= value < 110):
#             return "high", "Avoid caffeinated drinks and consult a doctor."
#         elif (160 <= value < 180) if is_systolic else (110 <= value < 120):
#             return "very high", "Consult a doctor."
#         else:
#             return "dangerously high", "Seek immediate medical attention."

#     systolic_class, systolic_rec = get_classification(systolic, True)
#     diastolic_class, diastolic_rec = get_classification(diastolic, False)

#     return {
#         "systolic": {"classification": systolic_class, "recommendation": systolic_rec},
#         "diastolic": {"classification": diastolic_class, "recommendation": diastolic_rec}
#     }

# # Define a function to classify lipid profile
# def classify_lipid_profile(cholesterol, triglyceride, hdl, ldl):
#     results = {}
#     if cholesterol < 200:
#         results['cholesterol'] = {"classification": "normal", "recommendation": None}
#     else:
#         results['cholesterol'] = {"classification": "high", "recommendation": "Reduce intake of fats and cholesterol."}
    
#     if triglyceride < 150:
#         results['triglyceride'] = {"classification": "normal", "recommendation": None}
#     else:
#         results['triglyceride'] = {"classification": "high", "recommendation": "Reduce intake of sugars and fats."}
    
#     results['hdl'] = {"classification": "low", "recommendation": "Increase physical activity."} if hdl < 40 else {"classification": "normal", "recommendation": None}
    
#     if ldl <= 100:
#         results['ldl'] = {"classification": "normal", "recommendation": None}
#     elif ldl > 190:
#         results['ldl'] = {"classification": "very high", "recommendation": "Medication may be needed."}
#     else:
#         results['ldl'] = {"classification": "high", "recommendation": "Reduce saturated fats."}

#     return results

# # Define a function to evaluate kidney health
# def classify_kidney_health(eGFR, creatinine, gender):
#     results = {}
#     # Classify eGFR
#     if eGFR < 15:
#         results['eGFR'] = {"classification": "Stage 5", "recommendation": "Seek medical advice."}
#     elif 15 <= eGFR < 30:
#         results['eGFR'] = {"classification": "Stage 4", "recommendation": "Seek medical advice."}
#     elif 30 <= eGFR < 60:
#         results['eGFR'] = {"classification": "Stage 3", "recommendation": "Seek medical advice."}
#     elif 60 <= eGFR <= 90:
#         results['eGFR'] = {"classification": "Stage 2", "recommendation": "Monitor kidney function."}
#     else:  # eGFR > 90
#         results['eGFR'] = {"classification": "Stage 1", "recommendation": "Monitor kidney function."}

#     # Classify Creatinine
#     if gender == 'M':
#         if creatinine <= 1.17:
#             results['creatinine'] = {"classification": "normal", "recommendation": None}
#         else:
#             results['creatinine'] = {"classification": "high", "recommendation": "Seek medical advice."}
#     elif gender == 'F':
#         if creatinine <= 0.95:
#             results['creatinine'] = {"classification": "normal", "recommendation": None}
#         else:
#             results['creatinine'] = {"classification": "high", "recommendation": "Seek medical advice."}

#     return results

# # Define a function to evaluate liver function
# def evaluate_liver_function(total_protein, globulin, albumin, ast, alt, alp, total_bilirubin, direct_bilirubin, gender):
#     results = {}

#     # Protein Levels
#     if 2.4 <= globulin <= 3.9:
#         results['globulin'] = {"classification": "normal", "recommendation": None}
#     else:
#         results['globulin'] = {"classification": "abnormal", "recommendation": "Consult a doctor."}

#     if albumin < 3.3:
#         results['albumin'] = {"classification": "low", "recommendation": "Seek medical advice."}
#     elif 3.3 <= albumin <= 5.2:
#         results['albumin'] = {"classification": "normal", "recommendation": None}

#     # Enzyme Levels
#     if gender == 'M':
#         results['AST'] = {"classification": "high", "recommendation": "Consult a doctor."} if ast > 40 else {"classification": "normal", "recommendation": None}
#         results['ALT'] = {"classification": "high", "recommendation": "Consult a doctor."} if alt > 41 else {"classification": "normal", "recommendation": None}
#     else:
#         results['AST'] = {"classification": "high", "recommendation": "Consult a doctor."} if ast > 32 else {"classification": "normal", "recommendation": None}
#         results['ALT'] = {"classification": "high", "recommendation": "Consult a doctor."} if alt > 33 else {"classification": "normal", "recommendation": None}

#     # Bilirubin Levels
#     if total_bilirubin > 0 or direct_bilirubin > 0:
#         results['bilirubin'] = {"classification": "high", "recommendation": None}
#     else:
#         results['bilirubin'] = {"classification": "normal", "recommendation": None}

#     return results

# # Define a function to evaluate uric acid levels
# def evaluate_uric_acid(uric_acid, gender):
#     results = {}
#     if gender == 'M':
#         if uric_acid > 7:
#             results['uric_acid'] = {"classification": "high", "recommendation": "Consult a doctor"}
#             # result['classification'] = "high"
#             # result['recommendation'] = "Consult a doctor."
#         else:
#             results['uric_acid'] = {"classification": "normal", "recommendation": None}
#             # result['classification'] = "normal"
#             # result['recommendation'] = None
#     elif gender == 'F':
#         if uric_acid > 6:
#             results['uric_acid'] = {"classification": "high", "recommendation": "Consult a doctor"}
#             # result['classification'] = "high"
#             # result['recommendation'] = "Consult a doctor."
#         else:
#             results['uric_acid'] = {"classification": "normal", "recommendation": None}
#             # result['classification'] = "normal"
#             # result['recommendation'] = None

#     return results

# # Define a function to evaluate complete blood count (CBC)
# def evaluate_cbc(hct, mcv, wbc, neutrophile, eosinophile, monocyte, plt_count, gender, basophile, lymphocyte):
#     results = {}

#     # Evaluate HCT
#     if gender == 'M':
#         if 42 <= hct <= 54:
#             results['HCT'] = {"classification": "normal", "recommendation": None}
#         elif 33 <= hct < 42:
#             results['HCT'] = {"classification": "low", "recommendation": "แนะนำตรวจเพิ่มเติม"}
#         elif 27 <= hct < 33:
#             results['HCT'] = {"classification": "moderately low", "recommendation": "ควรปรึกษาแพทย์"}
#         elif hct < 27:
#             results['HCT'] = {"classification": "dangerously low", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}
#     elif gender == 'F':
#         if 36 <= hct <= 48:
#             results['HCT'] = {"classification": "normal", "recommendation": None}
#         elif 33 <= hct < 36:
#             results['HCT'] = {"classification": "low", "recommendation": "แนะนำตรวจเพิ่มเติม"}
#         elif 27 <= hct < 33:
#             results['HCT'] = {"classification": "moderately low", "recommendation": "ควรปรึกษาแพทย์"}
#         elif hct < 27:
#             results['HCT'] = {"classification": "dangerously low", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}

#     # Evaluate MCV
#     if mcv < 80:
#         results['MCV'] = {"classification": "low", "recommendation": "อาจเกิดจากขาดธาตุเหล็ก หรือเป็นพาหะธาลัสซีเมีย"}
#     elif 80 <= mcv <= 100:
#         results['MCV'] = {"classification": "normal", "recommendation": None}
#     elif mcv > 100:
#         results['MCV'] = {"classification": "high", "recommendation": "อาจเกิดจากขาดโฟเลต หรือวิตามินบี 12 หรือโรคเลือดบางชนิด"}

#     # Evaluate WBC
#     if 6000 <= wbc <= 10000:
#         results['WBC'] = {"classification": "normal", "recommendation": None}
#     elif wbc < 6_000:
#         neutro_count = wbc * neutrophile / 100
#         if neutro_count < 1000:
#             results['WBC'] = {"classification": "Dangerously low", "recommendation": "ควรปรึกษาแพทย์ ระวังการติดเชื้อ หลีกเลี่ยงอาหารดิบ"}
#         else:
#             results['WBC'] = {"classification": "low", "recommendation": None}
#     elif 10_000 < wbc <= 20_000:
#         results['WBC'] = {"classification": "high", "recommendation": "อาจเกิดจากการติดเชื้อ หากมีไข้สูงหรือไข้เรื้อรัง ควรปรึกษาแพทย์"}
#     elif wbc > 20_000:
#         results['WBC'] = {"classification": "Very high", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}

#     # Evaluate EOSINOPHILE
#     eos_count = wbc * eosinophile / 100
#     if eos_count > 500:
#         results['Eosinophile'] = {"classification": "high", "recommendation": "อาจเกิดจากภูมิแพ้ หอบหืด หรือพยาธิ"}

#     # Evaluate MONOCYTE
#     if 2 <= monocyte <= 6:
#         results['Monocyte'] = {"classification": "normal", "recommendation": None}
#     elif monocyte > 6:
#         results['Monocyte'] = {"classification": "high", "recommendation": "มักพบหลังติดเชื้อเกิน 2 สัปดาห์ หรือหลังฉีดวัคซีน"}

#     # Evaluate Platelets
#     if plt_count < 100000:
#         results['PLT Count'] = {"classification": "low", "recommendation": "ควรระวังอาการเลือดออกผิดปกติ และควรพบแพทย์"}
#     elif 100000 <= plt_count <= 450000:
#         results['PLT Count'] = {"classification": "normal", "recommendation": None}
#     elif 450000 < plt_count <= 600000:
#         results['PLT Count'] = {"classification": "High", "recommendation": "อาจพบในพาหะธาลัสซีเมีย หรือมีอาการไข้เรื้อรัง ควรปรึกษาแพทย์"}
#     elif plt_count > 600000:
#         results['PLT Count'] = {"classification": "Very high", "recommendation": "ควรปรึกษาแพทย์เพื่อหาสาเหตุ"}
    
#     # Evaluate BASOPHILE
#     baso_count = wbc * basophile / 100
#     if 0 <= basophile <= 1 and 0.01 <= baso_count <= 0.1:
#         results['Basophile'] = {"classification": "normal", "recommendation": None}
#     elif basophile > 1 or baso_count > 0.1:
#         results['Basophile'] = {
#             "classification": "high",
#             "recommendation": "อาจเกิดจากภาวะภูมิแพ้ หรือโรคไขกระดูก ควรพบแพทย์"
#         }
    
#      # Evaluate LYMPHOCYTE
#     lymph_count = wbc * lymphocyte / 100
#     if 20 <= lymphocyte <= 40 and 1.0 <= lymph_count <= 3.0:
#         results['Lymphocyte'] = {"classification": "normal", "recommendation": None}
#     elif lymphocyte < 20 or lymph_count < 1.0:
#         results['Lymphocyte'] = {
#             "classification": "low",
#             "recommendation": "อาจเกิดจากภูมิคุ้มกันบกพร่อง หรือได้รับยาบางชนิด"
#         }
#     elif lymphocyte > 40 or lymph_count > 3.0:
#         results['Lymphocyte'] = {
#             "classification": "high",
#             "recommendation": "อาจเกิดจากการติดเชื้อไวรัส หรือโรคเลือด ควรตรวจเพิ่มเติม"
#         }

#     return results

# # Define a main function to evaluate lab results based on lab_test_id
# def evaluate_lab_results(lab_test_master_id, lab_item_values):
#     if lab_test_master_id == 1:  # Blood Pressure
#         return classify_bp(lab_item_values['Systolic'], lab_item_values['Diastolic'])
#     elif lab_test_master_id == 2:  # Lipid Profile
#         return classify_lipid_profile(
#             lab_item_values['Cholesterol'],
#             lab_item_values['Triglyceride'],
#             lab_item_values['HDL'],
#             lab_item_values['LDL']
#         )
#     elif lab_test_master_id == 3:  # Kidney Health
#         return classify_kidney_health(
#             lab_item_values['eGFR'],
#             lab_item_values['Creatinine'],
#             lab_item_values['Gender']
#         )
#     elif lab_test_master_id == 4:  # Liver Function
#         return evaluate_liver_function(
#             lab_item_values['Total Protein'],
#             lab_item_values['Globulin'],
#             lab_item_values['Albumin'],
#             lab_item_values['AST'],
#             lab_item_values['ALT'],
#             lab_item_values['ALP'],
#             lab_item_values['Total Bilirubin'],
#             lab_item_values['Direct Bilirubin'],
#             lab_item_values['Gender']
#         )
#     elif lab_test_master_id == 5:  # Uric Acid
#         return evaluate_uric_acid(lab_item_values['Uric Acid'], lab_item_values['Gender'])
#     elif lab_test_master_id == 6:  # Complete Blood Count (CBC)
#         return evaluate_cbc(
#             lab_item_values['HCT'],
#             lab_item_values['MCV'],
#             lab_item_values['WBC'],
#             lab_item_values['Neutrophile'],
#             lab_item_values['Eosinophile'],
#             lab_item_values['Monocyte'],
#             lab_item_values['PLT Count'],
#             lab_item_values['Gender'],
#             lab_item_values['Basophile'],
#             lab_item_values['Lymphocyte']
#         )
#     else:
#         return {"error": "Unknown lab test"}

# if __name__ == "__main__":
#     lab_test_master_id = sys.argv[1]  # Lab test ID (passed from Node.js)
#     lab_item_values = json.loads(sys.argv[2])  # Parse JSON input

#     result = evaluate_lab_results(int(lab_test_master_id), lab_item_values)
#     print(json.dumps(result))

import sys
import json

# ---------------------- Blood Pressure ----------------------
def classify_bp(systolic, diastolic):
    def classify(value, systolic_flag=True):
        if value < (140 if systolic_flag else 90):
            return "normal", None
        elif (140 <= value < 160) if systolic_flag else (90 <= value < 110):
            return "high", "Avoid caffeinated drinks and consult a doctor."
        elif (160 <= value < 180) if systolic_flag else (110 <= value < 120):
            return "very high", "Consult a doctor."
        else:
            return "dangerously high", "Seek immediate medical attention."

    s_class, s_rec = classify(systolic, True)
    d_class, d_rec = classify(diastolic, False)
    return {
        "systolic": {"classification": s_class, "recommendation": s_rec},
        "diastolic": {"classification": d_class, "recommendation": d_rec}
    }

# ---------------------- Lipid Profile -----------------------
def classify_lipid_profile(cholesterol, triglyceride, hdl, ldl):
    res = {}
    res["cholesterol"] = (
        {"classification": "normal", "recommendation": None}
        if cholesterol < 200
        else {"classification": "high", "recommendation": "Reduce intake of fats and cholesterol."}
    )

    res["triglyceride"] = (
        {"classification": "normal", "recommendation": None}
        if triglyceride < 150
        else {"classification": "high", "recommendation": "Reduce intake of sugars and fats."}
    )

    res["hdl"] = (
        {"classification": "low", "recommendation": "Increase physical activity."}
        if hdl < 40 else
        {"classification": "high", "recommendation": "May indicate other metabolic issues."}
        if hdl > 90 else
        {"classification": "normal", "recommendation": None}
    )

    if ldl <= 100:
        res["ldl"] = {"classification": "normal", "recommendation": None}
    elif 100 < ldl <= 190:
        res["ldl"] = {"classification": "high", "recommendation": "Reduce saturated fats."}
    else:
        res["ldl"] = {"classification": "very high", "recommendation": "Medication may be needed."}
    return res

# ---------------------- Kidney Health -----------------------
def classify_kidney_health(eGFR, creatinine, gender):
    g = gender.upper()
    res = {}
    if eGFR < 15:
        stage = "Stage 5"
    elif 15 <= eGFR < 30:
        stage = "Stage 4"
    elif 30 <= eGFR < 60:
        stage = "Stage 3"
    elif 60 <= eGFR < 90:
        stage = "Stage 2"
    else:  # >=90
        stage = "Stage 1"
    res["eGFR"] = {"classification": stage, "recommendation": "Monitor kidney function."}

    if g == "M":
        res["creatinine"] = (
            {"classification": "low", "recommendation": "May indicate low muscle mass."}
            if creatinine < 0.6 else
            {"classification": "normal", "recommendation": None}
            if creatinine <= 1.17 else
            {"classification": "high", "recommendation": "Seek medical advice."}
        )
    else:
        res["creatinine"] = (
            {"classification": "low", "recommendation": "May indicate low muscle mass."}
            if creatinine < 0.5 else
            {"classification": "normal", "recommendation": None}
            if creatinine <= 0.95 else
            {"classification": "high", "recommendation": "Seek medical advice."}
        )
    return res

# ---------------------- Liver Function ----------------------
def evaluate_liver_function(total_protein, globulin, albumin,
                            ast, alt, alp, total_bilirubin,
                            direct_bilirubin, gender):
    g = gender.upper()
    res = {}

    # Globulin
    if 2.4 <= globulin <= 3.9:
        res["globulin"] = {"classification": "normal", "recommendation": None}
    elif globulin < 2.4:
        res["globulin"] = {"classification": "low", "recommendation": "Possible immune deficiency"}
    else:
        res["globulin"] = {"classification": "high", "recommendation": "Consult a doctor."}

    # Albumin
    if albumin < 3.3:
        res["albumin"] = {"classification": "low", "recommendation": "Seek medical advice."}
    elif 3.3 <= albumin <= 5.2:
        res["albumin"] = {"classification": "normal", "recommendation": None}
    else:
        res["albumin"] = {"classification": "high", "recommendation": "Could indicate dehydration"}

    # Enzymes
    ast_cut = 40 if g == "M" else 32
    alt_cut = 41 if g == "M" else 33
    res["AST"] = {"classification": "high", "recommendation": "Consult a doctor."} if ast > ast_cut else {"classification": "normal", "recommendation": None}
    res["ALT"] = {"classification": "high", "recommendation": "Consult a doctor."} if alt > alt_cut else {"classification": "normal", "recommendation": None}
    res["ALP"] = (
        {"classification": "normal", "recommendation": None}
        if 44 <= alp <= 147
        else {"classification": "low", "recommendation": "Possible malnutrition"} if alp < 44
        else {"classification": "high", "recommendation": "Possible liver/bone disorder"}
    )

    # Bilirubin
    if total_bilirubin <= 1.2 and direct_bilirubin <= 0.3:
        res["bilirubin"] = {"classification": "normal", "recommendation": None}
    else:
        res["bilirubin"] = {"classification": "high", "recommendation": "Consult a doctor."}

    return res

# ---------------------- Uric Acid ---------------------------
def evaluate_uric_acid(uric_acid, gender):
    g = gender.upper()
    if g == "M":
        if uric_acid < 3.4:
            return {"uric_acid": {"classification": "low", "recommendation": "Possible kidney issue"}}
        elif uric_acid <= 7:
            return {"uric_acid": {"classification": "normal", "recommendation": None}}
        else:
            return {"uric_acid": {"classification": "high", "recommendation": "Consult a doctor"}}
    else:
        if uric_acid < 2.4:
            return {"uric_acid": {"classification": "low", "recommendation": "Possible kidney issue"}}
        elif uric_acid <= 6:
            return {"uric_acid": {"classification": "normal", "recommendation": None}}
        else:
            return {"uric_acid": {"classification": "high", "recommendation": "Consult a doctor"}}

# ---------------------- CBC ---------------------------------
def evaluate_cbc(hct, mcv, wbc, neutrophile, eosinophile,
                 monocyte, plt_count, gender, basophile, lymphocyte):
    g = gender.upper()
    res = {}

    # HCT
    if g == "M":
        if hct < 27:
            res["HCT"] = {"classification": "dangerously low", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}
        elif 27 <= hct < 33:
            res["HCT"] = {"classification": "moderately low", "recommendation": "ควรปรึกษาแพทย์"}
        elif 33 <= hct < 42:
            res["HCT"] = {"classification": "low", "recommendation": "แนะนำตรวจเพิ่มเติม"}
        elif 42 <= hct <= 54:
            res["HCT"] = {"classification": "normal", "recommendation": None}
        else:  # >54
            res["HCT"] = {"classification": "high", "recommendation": "อาจเกิดจากภาวะขาดน้ำหรือโรคเลือด"}
    else:
        if hct < 27:
            res["HCT"] = {"classification": "dangerously low", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}
        elif 27 <= hct < 33:
            res["HCT"] = {"classification": "moderately low", "recommendation": "ควรปรึกษาแพทย์"}
        elif 33 <= hct < 36:
            res["HCT"] = {"classification": "low", "recommendation": "แนะนำตรวจเพิ่มเติม"}
        elif 36 <= hct <= 48:
            res["HCT"] = {"classification": "normal", "recommendation": None}
        else:
            res["HCT"] = {"classification": "high", "recommendation": "อาจเกิดจากภาวะขาดน้ำหรือโรคเลือด"}

    # MCV
    if mcv < 80:
        res["MCV"] = {"classification": "low", "recommendation": "อาจเกิดจากขาดธาตุเหล็ก หรือพาหะธาลัสซีเมีย"}
    elif 80 <= mcv <= 100:
        res["MCV"] = {"classification": "normal", "recommendation": None}
    else:
        res["MCV"] = {"classification": "high", "recommendation": "อาจเกิดจากขาดโฟเลต หรือวิตามินบี12"}

    # WBC
    if wbc < 4000:
        res["WBC"] = {"classification": "dangerously low", "recommendation": "ควรปรึกษาแพทย์ ระวังการติดเชื้อ"}
    elif 4000 <= wbc < 6000:
        res["WBC"] = {"classification": "low", "recommendation": "อาจเกิดจากการกดไขกระดูก"}
    elif 6000 <= wbc <= 10000:
        res["WBC"] = {"classification": "normal", "recommendation": None}
    elif 10000 < wbc <= 20000:
        res["WBC"] = {"classification": "high", "recommendation": "อาจเกิดจากการติดเชื้อ"}
    else:
        res["WBC"] = {"classification": "very high", "recommendation": "ควรปรึกษาแพทย์โดยด่วน"}

    # Eosinophile
    eos_count = wbc * eosinophile / 100
    if eos_count > 500:
        res["Eosinophile"] = {"classification": "high", "recommendation": "อาจเกิดจากภูมิแพ้/พยาธิ"}
    else:
        res["Eosinophile"] = {"classification": "normal", "recommendation": None}

    # Monocyte
    if monocyte < 2:
        res["Monocyte"] = {"classification": "low", "recommendation": "อาจเกิดจากกดไขกระดูก"}
    elif 2 <= monocyte <= 6:
        res["Monocyte"] = {"classification": "normal", "recommendation": None}
    else:
        res["Monocyte"] = {"classification": "high", "recommendation": "มักพบหลังติดเชื้อ"}

    # Platelets
    if plt_count < 100000:
        res["PLT Count"] = {"classification": "low", "recommendation": "ควรพบแพทย์"}
    elif 100000 <= plt_count <= 450000:
        res["PLT Count"] = {"classification": "normal", "recommendation": None}
    elif 450000 < plt_count <= 600000:
        res["PLT Count"] = {"classification": "high", "recommendation": "อาจพบในพาหะธาลัสซีเมีย"}
    else:
        res["PLT Count"] = {"classification": "very high", "recommendation": "ควรปรึกษาแพทย์เพื่อหาสาเหตุ"}

    # Basophile
    baso_count = wbc * basophile / 100
    if basophile > 1 or baso_count > 0.1:
        res["Basophile"] = {"classification": "high", "recommendation": "อาจเกิดจากภูมิแพ้ หรือโรคไขกระดูก"}
    else:
        res["Basophile"] = {"classification": "normal", "recommendation": None}

    # Lymphocyte
    lymph_count = wbc * lymphocyte / 100
    if lymphocyte < 20 or lymph_count < 1.0:
        res["Lymphocyte"] = {"classification": "low", "recommendation": "อาจเกิดจากภูมิคุ้มกันบกพร่อง"}
    elif 20 <= lymphocyte <= 40 and 1.0 <= lymph_count <= 3.0:
        res["Lymphocyte"] = {"classification": "normal", "recommendation": None}
    else:
        res["Lymphocyte"] = {"classification": "high", "recommendation": "อาจเกิดจากการติดเชื้อไวรัส"}
    return res

# ---------------------- Dispatcher --------------------------
def evaluate_lab_results(lab_test_master_id, lab_item_values):
    mid = int(lab_test_master_id)
    if mid == 1:
        return classify_bp(lab_item_values["Systolic"], lab_item_values["Diastolic"])
    if mid == 2:
        return classify_lipid_profile(
            lab_item_values["Cholesterol"],
            lab_item_values["Triglyceride"],
            lab_item_values["HDL"],
            lab_item_values["LDL"],
        )
    if mid == 3:
        return classify_kidney_health(
            lab_item_values["eGFR"],
            lab_item_values["Creatinine"],
            lab_item_values["Gender"],
        )
    if mid == 4:
        return evaluate_liver_function(
            lab_item_values["Total Protein"],
            lab_item_values["Globulin"],
            lab_item_values["Albumin"],
            lab_item_values["AST"],
            lab_item_values["ALT"],
            lab_item_values["ALP"],
            lab_item_values["Total Bilirubin"],
            lab_item_values["Direct Bilirubin"],
            lab_item_values["Gender"],
        )
    if mid == 5:
        return evaluate_uric_acid(lab_item_values["Uric Acid"], lab_item_values["Gender"])
    if mid == 6:
        return evaluate_cbc(
            lab_item_values["HCT"],
            lab_item_values["MCV"],
            lab_item_values["WBC"],
            lab_item_values["Neutrophile"],
            lab_item_values["Eosinophile"],
            lab_item_values["Monocyte"],
            lab_item_values["PLT Count"],
            lab_item_values["Gender"],
            lab_item_values["Basophile"],
            lab_item_values["Lymphocyte"],
        )
    return {"error": "Unknown lab test"}

# ---------------------- CLI entry ---------------------------
if __name__ == "__main__":
    lab_test_master_id = sys.argv[1]
    lab_item_values = json.loads(sys.argv[2])
    print(json.dumps(evaluate_lab_results(lab_test_master_id, lab_item_values)))
