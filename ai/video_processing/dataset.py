"""PyTorch Dataset for keypoint sequences."""

from pathlib import Path

import numpy as np
import torch
from torch.utils.data import Dataset


class KeypointSequenceDataset(Dataset):
    def __init__(self, data_dir: str | Path):
        data_dir = Path(data_dir)
        self.sequences = np.load(data_dir / "sequences.npy")
        self.labels = np.load(data_dir / "labels.npy")

    def __len__(self) -> int:
        return len(self.labels)

    def __getitem__(self, idx: int) -> tuple[torch.Tensor, torch.Tensor]:
        seq = torch.tensor(self.sequences[idx], dtype=torch.float32)
        label = torch.tensor(self.labels[idx], dtype=torch.long)
        return seq, label
