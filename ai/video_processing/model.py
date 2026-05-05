"""Bidirectional LSTM classifier for pose-based behavior recognition."""

import torch
import torch.nn as nn

from config import BIDIRECTIONAL, DROPOUT, HIDDEN_SIZE, INPUT_FEATURES, NUM_LAYERS


class BehaviorLSTM(nn.Module):
    def __init__(
        self,
        input_size: int = INPUT_FEATURES,
        hidden_size: int = HIDDEN_SIZE,
        num_layers: int = NUM_LAYERS,
        num_classes: int = 2,
        dropout: float = DROPOUT,
        bidirectional: bool = BIDIRECTIONAL,
    ):
        super().__init__()
        self.hidden_size = hidden_size
        self.num_layers = num_layers
        self.num_directions = 2 if bidirectional else 1

        self.lstm = nn.LSTM(
            input_size=input_size,
            hidden_size=hidden_size,
            num_layers=num_layers,
            batch_first=True,
            dropout=dropout if num_layers > 1 else 0.0,
            bidirectional=bidirectional,
        )

        self.dropout = nn.Dropout(dropout)
        self.fc = nn.Linear(hidden_size * self.num_directions, num_classes)

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        # x shape: (batch, seq_len, input_size)
        lstm_out, _ = self.lstm(x)
        # Use the last timestep output
        last_output = lstm_out[:, -1, :]
        out = self.dropout(last_output)
        return self.fc(out)
