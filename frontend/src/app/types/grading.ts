export interface IPointSettings {
    part1PointsPerQuestion: number;
    part2PointsPerQuestion: number;
    part3PointsPerQuestion: number;
    part2SpecialMode: boolean;
    part2PenaltyByWrongCount: {
        "1": number;
        "2": number;
        "3": number;
        "4": number;
    };
}

export interface IGradingConfig {
    pointSettings?: Partial<IPointSettings>;
    [key: string]: unknown;
}

export const DEFAULT_POINT_SETTINGS: IPointSettings = {
    part1PointsPerQuestion: 0,
    part2PointsPerQuestion: 0,
    part3PointsPerQuestion: 0,
    part2SpecialMode: false,
    part2PenaltyByWrongCount: {
        "1": 0,
        "2": 0,
        "3": 0,
        "4": 0,
    },
};

export const getPointSettings = (
    gradingConfig?: IGradingConfig,
    defaultPointsPerAnswer = 0,
    defaultPart2PointsPerQuestion = defaultPointsPerAnswer * 4,
): IPointSettings => {
    const savedSettings = gradingConfig?.pointSettings;
    const defaultPenalties = {
        "1": defaultPart2PointsPerQuestion * 0.5,
        "2": defaultPart2PointsPerQuestion * 0.75,
        "3": defaultPart2PointsPerQuestion * 0.75,
        "4": defaultPart2PointsPerQuestion,
    };

    return {
        ...DEFAULT_POINT_SETTINGS,
        part1PointsPerQuestion: defaultPointsPerAnswer,
        part2PointsPerQuestion: defaultPart2PointsPerQuestion,
        part3PointsPerQuestion: defaultPointsPerAnswer,
        ...savedSettings,
        part2PenaltyByWrongCount: {
            ...defaultPenalties,
            ...(savedSettings?.part2PenaltyByWrongCount ?? {}),
        },
    };
};
