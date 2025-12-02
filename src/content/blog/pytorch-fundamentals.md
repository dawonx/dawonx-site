---
title: "PyTorch Fundamentals: Building Blocks of Deep Learning"

description: "Understanding tensors, autograd, and neural networks in PyTorch - Week 2 of Naver Boostcamp AI Tech."

image: "/assets/background_img_small.png"
category: "ai"
subcategory: "Naver Boostcamp AI Tech"

date: "2025-01-10"

series:
  name: "Naver Boostcamp AI Tech"
  order: 1
color: "#FF6B6B"
---

*Part of the Naver Boostcamp AI Tech series - Week 2*

## Introduction

PyTorch has become one of the most popular deep learning frameworks, favored by researchers and practitioners alike for its dynamic computation graphs and Pythonic design. In this post, I'll share my learnings from Week 2 of Naver Boostcamp AI Tech, focusing on PyTorch fundamentals.

## Why PyTorch?

Before diving into the technical details, let's understand what makes PyTorch special:

- **Dynamic Computation Graphs**: Unlike static graph frameworks, PyTorch builds the graph on-the-fly, making debugging intuitive
- **Pythonic Design**: Feels natural to Python developers
- **Strong GPU Acceleration**: Seamless CUDA integration
- **Rich Ecosystem**: Extensive libraries for computer vision, NLP, and more

## Core Concepts

### 1. Tensors: The Foundation

Tensors are the fundamental data structure in PyTorch, similar to NumPy arrays but with GPU acceleration capabilities.

```python
import torch

# Creating tensors
x = torch.tensor([[1, 2], [3, 4]])
y = torch.zeros(2, 3)
z = torch.randn(2, 3)  # Random normal distribution

# Moving to GPU
if torch.cuda.is_available():
    x = x.cuda()
```

### 2. Autograd: Automatic Differentiation

PyTorch's autograd system automatically computes gradients, which is essential for training neural networks.

```python
# Enable gradient computation
x = torch.tensor([2.0], requires_grad=True)
y = x ** 2
y.backward()  # Compute gradients
print(x.grad)  # dy/dx = 2x = 4.0
```

### 3. Building Neural Networks

PyTorch provides `nn.Module` as the base class for all neural network modules.

```python
import torch.nn as nn
import torch.nn.functional as F

class SimpleNet(nn.Module):
    def __init__(self):
        super(SimpleNet, self).__init__()
        self.fc1 = nn.Linear(784, 128)
        self.fc2 = nn.Linear(128, 10)
        
    def forward(self, x):
        x = F.relu(self.fc1(x))
        x = self.fc2(x)
        return F.log_softmax(x, dim=1)
```

## Training Loop Pattern

A typical PyTorch training loop follows this pattern:

```python
model = SimpleNet()
optimizer = torch.optim.Adam(model.parameters(), lr=0.001)
criterion = nn.CrossEntropyLoss()

for epoch in range(num_epochs):
    for batch_idx, (data, target) in enumerate(train_loader):
        # Forward pass
        output = model(data)
        loss = criterion(output, target)
        
        # Backward pass
        optimizer.zero_grad()
        loss.backward()
        optimizer.step()
```

## Key Takeaways from Boostcamp

### 1. Device Agnostic Code

Always write code that can run on both CPU and GPU:

```python
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = model.to(device)
data = data.to(device)
```

### 2. DataLoader is Your Friend

Use DataLoader for efficient batch processing:

```python
from torch.utils.data import DataLoader, TensorDataset

dataset = TensorDataset(X_train, y_train)
loader = DataLoader(dataset, batch_size=32, shuffle=True)
```

### 3. Model Checkpointing

Save your model regularly during training:

```python
# Save
torch.save({
    'epoch': epoch,
    'model_state_dict': model.state_dict(),
    'optimizer_state_dict': optimizer.state_dict(),
    'loss': loss,
}, 'checkpoint.pth')

# Load
checkpoint = torch.load('checkpoint.pth')
model.load_state_dict(checkpoint['model_state_dict'])
```

## Common Pitfalls and Solutions

### 1. Gradient Accumulation
Remember to zero gradients before each backward pass:
```python
optimizer.zero_grad()  # Don't forget this!
```

### 2. Tensor Shape Mismatches
Always verify tensor shapes during development:
```python
print(f"Input shape: {x.shape}")
print(f"Output shape: {model(x).shape}")
```

### 3. Memory Management
Clear cache when working with large models:
```python
torch.cuda.empty_cache()
```

## Practical Project: MNIST Classifier

Here's a complete example bringing everything together:

```python
import torch
import torch.nn as nn
import torch.optim as optim
from torchvision import datasets, transforms
from torch.utils.data import DataLoader

# Define model
class MNISTNet(nn.Module):
    def __init__(self):
        super(MNISTNet, self).__init__()
        self.conv1 = nn.Conv2d(1, 32, 3, 1)
        self.conv2 = nn.Conv2d(32, 64, 3, 1)
        self.dropout1 = nn.Dropout2d(0.25)
        self.dropout2 = nn.Dropout2d(0.5)
        self.fc1 = nn.Linear(9216, 128)
        self.fc2 = nn.Linear(128, 10)

    def forward(self, x):
        x = self.conv1(x)
        x = F.relu(x)
        x = self.conv2(x)
        x = F.relu(x)
        x = F.max_pool2d(x, 2)
        x = self.dropout1(x)
        x = torch.flatten(x, 1)
        x = self.fc1(x)
        x = F.relu(x)
        x = self.dropout2(x)
        x = self.fc2(x)
        return F.log_softmax(x, dim=1)

# Training configuration
device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
model = MNISTNet().to(device)
optimizer = optim.Adam(model.parameters(), lr=0.001)

# Data loading
transform = transforms.Compose([
    transforms.ToTensor(),
    transforms.Normalize((0.1307,), (0.3081,))
])

train_dataset = datasets.MNIST('./data', train=True, download=True, transform=transform)
train_loader = DataLoader(train_dataset, batch_size=64, shuffle=True)

# Training loop
model.train()
for epoch in range(5):
    for batch_idx, (data, target) in enumerate(train_loader):
        data, target = data.to(device), target.to(device)
        optimizer.zero_grad()
        output = model(data)
        loss = F.nll_loss(output, target)
        loss.backward()
        optimizer.step()
        
        if batch_idx % 100 == 0:
            print(f'Epoch: {epoch}, Batch: {batch_idx}, Loss: {loss.item():.4f}')
```

## What's Next?

In the next post, I'll dive into more advanced PyTorch topics:
- Custom datasets and data augmentation
- Transfer learning with pretrained models
- Mixed precision training
- Distributed training strategies

## Resources

- [PyTorch Official Tutorials](https://pytorch.org/tutorials/)
- [PyTorch Documentation](https://pytorch.org/docs/stable/index.html)
- [Naver Boostcamp AI Tech](https://boostcamp.connect.or.kr/)
- [Deep Learning with PyTorch (Book)](https://pytorch.org/deep-learning-with-pytorch)

## Conclusion

PyTorch's flexibility and intuitive design make it an excellent choice for both research and production. The key is understanding its core concepts: tensors, autograd, and the module system. With these fundamentals, you can build anything from simple classifiers to state-of-the-art models.

Stay tuned for the next post in the Naver Boostcamp AI Tech series, where we'll explore more advanced PyTorch techniques!

---

*This post is part of my learning journey at Naver Boostcamp AI Tech. Feel free to reach out if you have questions or want to discuss deep learning!*