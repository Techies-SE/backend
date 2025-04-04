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
        results['cholesterol'] = ("normal", None)
    else:
        results['cholesterol'] = ("high", "Reduce intake of fats and cholesterol.")
    
    if triglyceride < 150:
        results['triglyceride'] = ("normal", None)
    else:
        results['triglyceride'] = ("high", "Reduce intake of sugars and fats.")
    
    results['hdl'] = ("low", "Increase physical activity.") if hdl < 40 else ("normal", None)
    
    if ldl <= 100:
        results['ldl'] = ("normal", None)
    elif ldl > 190:
        results['ldl'] = ("very high", "Medication may be needed.")
    else:
        results['ldl'] = ("high", "Reduce saturated fats.")

    return results

# Define a function to evaluate kidney health
def classify_kidney_health(eGFR, creatinine, gender):
    results = {}

    # Classify eGFR
    if eGFR < 15:
        results['eGFR'] = ("Stage 5", "Seek medical advice.")
    elif 15 <= eGFR < 30:
        results['eGFR'] = ("Stage 4", "Seek medical advice.")
    elif 30 <= eGFR < 60:
        results['eGFR'] = ("Stage 3", "Seek medical advice.")
    elif 60 <= eGFR <= 90:
        results['eGFR'] = ("Stage 2", "Monitor kidney function.")
    else:  # eGFR > 90
        results['eGFR'] = ("Stage 1", "Monitor kidney function.")

    # Classify Creatinine
    if gender == 'M':
        if creatinine <= 1.17:
            results['creatinine'] = ("normal", None)
        else:
            results['creatinine'] = ("high", "Seek medical advice.")
    elif gender == 'F':
        if creatinine <= 0.95:
            results['creatinine'] = ("normal", None)
        else:
            results['creatinine'] = ("high", "Seek medical advice.")

    return results

# Define a function to evaluate liver function
def evaluate_liver_function(total_protein, globulin, albumin, ast, alt, alp, total_bilirubin, direct_bilirubin, gender):
    results = {}

    # Protein Levels
    if 2.4 <= globulin <= 3.9:
        results['globulin'] = ("normal", None)
    else:
        results['globulin'] = ("abnormal", "Consult a doctor.")

    if albumin < 3.3:
        results['albumin'] = ("low", "Seek medical advice.")
    elif 3.3 <= albumin <= 5.2:
        results['albumin'] = ("normal", None)

    # Enzyme Levels
    if gender == 'M':
        results['AST'] = ("high", "Consult a doctor.") if ast > 40 else ("normal", None)
        results['ALT'] = ("high", "Consult a doctor.") if alt > 41 else ("normal", None)
    else:
        results['AST'] = ("high", "Consult a doctor.") if ast > 32 else ("normal", None)
        results['ALT'] = ("high", "Consult a doctor.") if alt > 33 else ("normal", None)

    # Bilirubin Levels
    if total_bilirubin > 0 or direct_bilirubin > 0:
        results['bilirubin'] = ("high", None)
    else:
        results['bilirubin'] = ("normal", None)

    return results

# Define a function to evaluate uric acid levels
def evaluate_uric_acid(uric_acid, gender):
    result = {}
    if gender == 'M':
        if uric_acid > 7:
            result['classification'] = "high"
            result['recommendation'] = "Consult a doctor."
        else:
            result['classification'] = "normal"
            result['recommendation'] = None
    elif gender == 'F':
        if uric_acid > 6:
            result['classification'] = "high"
            result['recommendation'] = "Consult a doctor."
        else:
            result['classification'] = "normal"
            result['recommendation'] = None

    return result

# Define a main function to evaluate lab results based on lab_test_id
def evaluate_lab_results(lab_test_id, lab_item_values):
    if lab_test_id == '1':  # Blood Pressure
        return classify_bp(lab_item_values['systolic'], lab_item_values['diastolic'])
    elif lab_test_id == '2':  # Lipid Profile
        return classify_lipid_profile(
            lab_item_values['cholesterol'],
            lab_item_values['triglyceride'],
            lab_item_values['hdl'],
            lab_item_values['ldl']
        )
    elif lab_test_id == '3':  # Kidney Health
        return classify_kidney_health(
            lab_item_values['eGFR'],
            lab_item_values['creatinine'],
            lab_item_values['gender']
        )
    elif lab_test_id == '4':  # Liver Function
        return evaluate_liver_function(
            lab_item_values['total_protein'],
            lab_item_values['globulin'],
            lab_item_values['albumin'],
            lab_item_values['ast'],
            lab_item_values['alt'],
            lab_item_values['alp'],
            lab_item_values['total_bilirubin'],
            lab_item_values['direct_bilirubin'],
            lab_item_values['gender']
        )
    elif lab_test_id == '5':  # Uric Acid
        return evaluate_uric_acid(lab_item_values['uric_acid'], lab_item_values['gender'])
    else:
        return {"error": "Unknown lab test"}

if __name__ == "__main__":
    lab_test_id = sys.argv[1]  # Lab test ID (passed from Node.js)
    lab_item_values = json.loads(sys.argv[2])  # Parse JSON input

    result = evaluate_lab_results(lab_test_id, lab_item_values)
    print(json.dumps(result))
