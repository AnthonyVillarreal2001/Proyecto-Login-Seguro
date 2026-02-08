const mockNet = { loadFromUri: jest.fn().mockResolvedValue() };

module.exports = {
  nets: {
    ssdMobilenetv1: mockNet,
    faceLandmark68Net: mockNet,
    faceRecognitionNet: mockNet,
    faceExpressionNet: mockNet
  },
  detectSingleFace: jest.fn().mockResolvedValue(null)
};
