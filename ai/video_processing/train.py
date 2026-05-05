"""Training loop for the BehaviorLSTM classifier."""

import json
import logging
import time
from pathlib import Path

import torch
import torch.nn as nn
from torch.utils.data import DataLoader

from config import BATCH_SIZE, DATA_DIR, LEARNING_RATE, LOG_DIR, MODEL_DIR, NUM_EPOCHS, PATIENCE
from dataset import KeypointSequenceDataset
from model import BehaviorLSTM

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)


def compute_metrics(
    preds: torch.Tensor, targets: torch.Tensor
) -> dict[str, float]:
    tp = ((preds == 1) & (targets == 1)).sum().item()
    fp = ((preds == 1) & (targets == 0)).sum().item()
    fn = ((preds == 0) & (targets == 1)).sum().item()
    tn = ((preds == 0) & (targets == 0)).sum().item()

    accuracy = (tp + tn) / max(tp + tn + fp + fn, 1)
    precision = tp / max(tp + fp, 1)
    recall = tp / max(tp + fn, 1)
    f1 = 2 * precision * recall / max(precision + recall, 1e-8)

    return {
        "accuracy": accuracy,
        "precision": precision,
        "recall": recall,
        "f1": f1,
        "tp": tp,
        "fp": fp,
        "fn": fn,
        "tn": tn,
    }


def train_epoch(
    model: BehaviorLSTM,
    loader: DataLoader,
    criterion: nn.Module,
    optimizer: torch.optim.Optimizer,
    device: torch.device,
) -> tuple[float, dict[str, float]]:
    model.train()
    total_loss = 0.0
    all_preds = []
    all_targets = []

    for sequences, labels in loader:
        sequences, labels = sequences.to(device), labels.to(device)
        optimizer.zero_grad()
        outputs = model(sequences)
        loss = criterion(outputs, labels)
        loss.backward()
        torch.nn.utils.clip_grad_norm_(model.parameters(), max_norm=1.0)
        optimizer.step()

        total_loss += loss.item() * len(labels)
        all_preds.append(outputs.argmax(dim=1).cpu())
        all_targets.append(labels.cpu())

    avg_loss = total_loss / len(loader.dataset)
    metrics = compute_metrics(torch.cat(all_preds), torch.cat(all_targets))
    return avg_loss, metrics


@torch.no_grad()
def evaluate(
    model: BehaviorLSTM,
    loader: DataLoader,
    criterion: nn.Module,
    device: torch.device,
) -> tuple[float, dict[str, float]]:
    model.eval()
    total_loss = 0.0
    all_preds = []
    all_targets = []

    for sequences, labels in loader:
        sequences, labels = sequences.to(device), labels.to(device)
        outputs = model(sequences)
        loss = criterion(outputs, labels)
        total_loss += loss.item() * len(labels)
        all_preds.append(outputs.argmax(dim=1).cpu())
        all_targets.append(labels.cpu())

    avg_loss = total_loss / len(loader.dataset)
    metrics = compute_metrics(torch.cat(all_preds), torch.cat(all_targets))
    return avg_loss, metrics


def main():
    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    log.info("Using device: %s", device)

    train_ds = KeypointSequenceDataset(DATA_DIR / "train")
    val_ds = KeypointSequenceDataset(DATA_DIR / "val")
    log.info("Train: %d samples, Val: %d samples", len(train_ds), len(val_ds))

    train_loader = DataLoader(train_ds, batch_size=BATCH_SIZE, shuffle=True, num_workers=0)
    val_loader = DataLoader(val_ds, batch_size=BATCH_SIZE, shuffle=False, num_workers=0)

    model = BehaviorLSTM().to(device)
    criterion = nn.CrossEntropyLoss()
    optimizer = torch.optim.Adam(model.parameters(), lr=LEARNING_RATE)
    scheduler = torch.optim.lr_scheduler.ReduceLROnPlateau(
        optimizer, mode="min", factor=0.5, patience=5
    )

    log.info("Model parameters: %d", sum(p.numel() for p in model.parameters()))

    best_val_loss = float("inf")
    patience_counter = 0
    history = []

    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    LOG_DIR.mkdir(parents=True, exist_ok=True)

    start_time = time.time()
    for epoch in range(1, NUM_EPOCHS + 1):
        train_loss, train_metrics = train_epoch(model, train_loader, criterion, optimizer, device)
        val_loss, val_metrics = evaluate(model, val_loader, criterion, device)
        scheduler.step(val_loss)

        record = {
            "epoch": epoch,
            "train_loss": train_loss,
            "val_loss": val_loss,
            **{f"train_{k}": v for k, v in train_metrics.items()},
            **{f"val_{k}": v for k, v in val_metrics.items()},
            "lr": optimizer.param_groups[0]["lr"],
        }
        history.append(record)

        log.info(
            "Epoch %02d | train_loss=%.4f acc=%.3f f1=%.3f | val_loss=%.4f acc=%.3f f1=%.3f",
            epoch,
            train_loss,
            train_metrics["accuracy"],
            train_metrics["f1"],
            val_loss,
            val_metrics["accuracy"],
            val_metrics["f1"],
        )

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            patience_counter = 0
            torch.save(
                {
                    "epoch": epoch,
                    "model_state_dict": model.state_dict(),
                    "optimizer_state_dict": optimizer.state_dict(),
                    "val_loss": val_loss,
                    "val_metrics": val_metrics,
                },
                MODEL_DIR / "best_behavior_lstm.pt",
            )
            log.info("  ↑ Saved best model (val_loss=%.4f)", val_loss)
        else:
            patience_counter += 1
            if patience_counter >= PATIENCE:
                log.info("Early stopping at epoch %d", epoch)
                break

    elapsed = time.time() - start_time
    log.info("Training complete in %.1f minutes", elapsed / 60)

    with open(LOG_DIR / "training_history.json", "w") as f:
        json.dump(history, f, indent=2)

    log.info("History saved to %s", LOG_DIR / "training_history.json")


if __name__ == "__main__":
    main()
