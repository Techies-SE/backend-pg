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

     # ---------- Total Protein ----------
    if total_protein < 6.0:
        res["Total Protein"] = {
            "classification": "low",
            "recommendation": "อาจเกิดจากภาวะขาดสารอาหารหรือโรคตับ ควรปรึกษาแพทย์"
        }
    elif 6.0 <= total_protein <= 8.3:
        res["Total Protein"] = {"classification": "normal", "recommendation": None}
    else:
        res["Total Protein"] = {
            "classification": "high",
            "recommendation": "อาจเกิดจากภาวะขาดน้ำหรือการอักเสบเรื้อรัง"
        }

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

     # ---------- Total Bilirubin ----------
    if total_bilirubin < 0.1:
        res["Total Bilirubin"] = {"classification": "low", "recommendation": "อาจเกิดจากภาวะขาดสารอาหาร"}
    elif 0.1 <= total_bilirubin <= 1.2:
        res["Total Bilirubin"] = {"classification": "normal", "recommendation": None}
    else:
        res["Total Bilirubin"] = {
            "classification": "high",
            "recommendation": "อาจเกิดจากโรคตับหรือท่อน้ำดีอุดตัน ควรปรึกษาแพทย์"
        }

    # ---------- Direct Bilirubin ----------
    if direct_bilirubin < 0.0:
        res["Direct Bilirubin"] = {"classification": "low", "recommendation": None}
    elif 0.0 <= direct_bilirubin <= 0.3:
        res["Direct Bilirubin"] = {"classification": "normal", "recommendation": None}
    else:
        res["Direct Bilirubin"] = {
            "classification": "high",
            "recommendation": "อาจเกิดจากตับอักเสบหรือท่อน้ำดีอุดตัน ควรปรึกษาแพทย์"
        }

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
    
     # ---------------------- Neutrophile ----------------------
    # neutrophile is % of WBC
    anc = wbc * neutrophile / 100.0  # absolute neutrophil count
    if anc < 1000:
        res["Neutrophile"] = {"classification": "dangerously low",
                              "recommendation": "เสี่ยงต่อการติดเชื้อรุนแรง ควรพบแพทย์ทันที"}
    elif 1000 <= anc < 1500:
        res["Neutrophile"] = {"classification": "low",
                              "recommendation": "อาจเกิดจากการกดไขกระดูก/การติดเชื้อไวรัส"}
    elif 1500 <= anc <= 8000 and 40 <= neutrophile <= 60:
        res["Neutrophile"] = {"classification": "normal", "recommendation": None}
    elif 8000 < anc <= 20000:
        res["Neutrophile"] = {"classification": "high",
                              "recommendation": "อาจเกิดจากการติดเชื้อแบคทีเรียหรือการอักเสบ"}
    else:  # anc > 20000 or extreme %
        res["Neutrophile"] = {"classification": "very high",
                              "recommendation": "ควรปรึกษาแพทย์เพื่อตรวจหาสาเหตุ เช่น การติดเชื้อรุนแรงหรือมะเร็งเม็ดเลือด"}

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
