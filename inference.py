from transformers import AutoModelForSequenceClassification, AutoTokenizer
import os

# Load model and tokenizer
model_dir = os.path.join(os.path.dirname(__file__), "fine_tuned_clinicalbert")
model = AutoModelForSequenceClassification.from_pretrained(model_dir)
tokenizer = AutoTokenizer.from_pretrained(model_dir)

def predict(input_text: str, age: int) -> int:
    """
    Predicts the label for the given input text and age.

    Args:
        input_text (str): The chief complaint or input text.
        age (int): The age of the patient.

    Returns:
        int: The predicted class label.
    """
    # Combine input text and age
    input_text_with_age = f"Chief Complaint: {input_text} Age: {age}"

    # Tokenize input
    inputs = tokenizer(input_text_with_age, return_tensors="pt")

    # Get model predictions
    outputs = model(**inputs)
    predicted_class = outputs.logits.argmax(dim=-1).item()

    return predicted_class