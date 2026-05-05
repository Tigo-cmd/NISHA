"""Evaluate trained BehaviorLSTM on the test set with full metrics."""

import json
import logging

import numpy as np
import torch
from torch.utils.data import DataLoader

from config import BATCH_SIZE, CLASS_MAP, DATA_DIR, LOG_DIR, MODEL_DIR
from dataset import KeypointSequenceDataset
from model import BehaviorLSTM

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

    test_ds = KeypointSequenceDataset(DATA_DIR / "test")
    test_loader = DataLoader(test_ds, batch_size=BATCH_SIZE, shuffle=False)
    log.info("Test samples: %d", len(test_ds))

    model = BehaviorLSTM().to(device)
    ckpt = torch.load(MODEL_DIR / "best_behavior_lstm.pt", map_location=device, weights_only=True)
    model.load_state_dict(ckpt["model_state_dict"])
    model.eval()
    log.info("Loaded model from epoch %d (val_loss=%.4f)", ckpt["epoch"], ckpt["val_loss"])

    all_preds = []
    all_targets = []
    all_probs = []

    with torch.no_grad():
        for sequences, labels in test_loader:
            sequences = sequences.to(device)
            outputs = model(sequences)
            probs = torch.softmax(outputs, dim=1)
            all_preds.append(outputs.argmax(dim=1).cpu().numpy())
            all_targets.append(labels.numpy())
            all_probs.append(probs.cpu().numpy())

    preds = np.concatenate(all_preds)
    targets = np.concatenate(all_targets)
    probs = np.concatenate(all_probs)

    # Confusion matrix
    num_classes = len(CLASS_MAP)
    cm = np.zeros((num_classes, num_classes), dtype=int)
    for t, p in zip(targets, preds):
        cm[t][p] += 1

    log.info("Confusion Matrix:")
    log.info("                 Predicted")
    log.info("              NonViolence  Violence")
    log.info("  NonViolence    %4d        %4d", cm[0][0], cm[0][1])
    log.info("  Violence       %4d        %4d", cm[1][0], cm[1][1])

    # Per-class metrics
    results = {"confusion_matrix": cm.tolist(), "per_class": {}}
    for cls_idx, cls_name in CLASS_MAP.items():
        tp = cm[cls_idx][cls_idx]
        fp = cm[:, cls_idx].sum() - tp
        fn = cm[cls_idx, :].sum() - tp
        tn = cm.sum() - tp - fp - fn

        precision = tp / max(tp + fp, 1)
        recall = tp / max(tp + fn, 1)
        f1 = 2 * precision * recall / max(precision + recall, 1e-8)

        results["per_class"][cls_name] = {
            "precision": round(precision, 4),
            "recall": round(recall, 4),
            "f1": round(f1, 4),
            "support": int(tp + fn),
        }
        log.info(
            "  %s: precision=%.3f recall=%.3f f1=%.3f (n=%d)",
            cls_name, precision, recall, f1, tp + fn,
        )

    overall_acc = (preds == targets).mean()
    results["accuracy"] = round(float(overall_acc), 4)
    results["total_samples"] = len(targets)
    log.info("Overall accuracy: %.3f (%d samples)", overall_acc, len(targets))

    LOG_DIR.mkdir(parents=True, exist_ok=True)
    with open(LOG_DIR / "test_results.json", "w") as f:
        json.dump(results, f, indent=2)
    log.info("Results saved to %s", LOG_DIR / "test_results.json")


if __name__ == "__main__":
    main()
