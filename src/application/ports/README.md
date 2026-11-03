# Application ports

These contracts define the capabilities that application use cases may request
from outer-layer adapters. They contain no infrastructure implementation.

Infrastructure adapters should implement every method named by the corresponding
port. Wiring and runtime contract checks belong in the composition root.
