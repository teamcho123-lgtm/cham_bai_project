class BaiThi:
    def __init__(self):
        self.sbd = ""
        self.ma_de = ""

        self.part1 = {}
        self.part2 = {}
        self.part3 = {}

    def to_dict(self):
        return {
            "sbd": self.sbd,
            "ma_de": self.ma_de,
            "part1": self.part1,
            "part2": self.part2,
            "part3": self.part3
        }