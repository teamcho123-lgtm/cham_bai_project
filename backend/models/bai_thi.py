from dataclasses import dataclass, field

@dataclass
class BaiThi:

    sbd: str = ""
    ma_de: str = ""

    part1: dict = field(default_factory=dict)
    part2: dict = field(default_factory=dict)
    part3: dict = field(default_factory=dict)